import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { EVENTS, ITEMS, SOURCES, db } from "../firebase";
import type {
  CoverageEntry,
  EventDoc,
  ItemDoc,
  SourceDoc,
} from "../domain";
import { checkCoverage, type CoverageTarget, type NaverCredentials } from "../collect/naver";
import { itemIdFor } from "../collect/item-id";

/**
 * 큐레이션 — 후보 풀에서 사건을 만든다.
 *
 * 자동화하지 않는다. 무엇이 '하나의 사건' 인지는 사람이 정한다.
 * 이 모듈은 사람이 정한 것을 정확히 기록하는 일만 한다.
 */

export function kstDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "2026-07-26 10:00" (KST) → Date. 타임존을 빼먹으면 지연이 9시간 틀린다. */
export function parseKst(input: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(input.trim());
  if (!m) throw new Error(`시각 형식이 아닙니다: "${input}" (예: 2026-07-26 10:00)`);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`);
}

function slugify(title: string, date: string): string {
  // 한글 제목을 로마자로 바꾸지 않는다 — 틀리게 옮기느니 해시가 낫다.
  // base64url 은 '-' 와 '_' 를 포함해 날짜 부분과 섞여 읽히므로 16진수를 쓴다.
  const suffix = createHash("sha1").update(title).digest("hex").slice(0, 6);
  return `${date}-${suffix}`;
}

/** 초안을 지운다. 발행된 사건은 지우지 않는다 — 공개된 URL 이 죽는다. */
export async function deleteDraft(slug: string): Promise<void> {
  const event = await getEvent(slug);
  if (event.status === "published") {
    throw new Error(
      `발행된 사건은 지울 수 없습니다: ${slug}\n` +
        `공개된 주소가 죽습니다. 내려야 한다면 status 를 draft 로 되돌리세요.`,
    );
  }

  // 배정된 항목은 후보 풀로 되돌린다. 지우면 다시 수집해야 한다.
  const items = await db.collection(ITEMS).where("eventId", "==", slug).get();
  for (let i = 0; i < items.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of items.docs.slice(i, i + 400)) {
      batch.update(doc.ref, { eventId: null, frameKey: null });
    }
    await batch.commit();
  }

  await db.collection(EVENTS).doc(slug).delete();
}

export async function createEvent(title: string, occurredAt: Date): Promise<string> {
  const date = kstDateString(occurredAt);
  const slug = slugify(title, date);
  const now = Timestamp.now();

  const ref = db.collection(EVENTS).doc(slug);
  if ((await ref.get()).exists) {
    throw new Error(`이미 있는 사건입니다: ${slug}`);
  }

  const doc: EventDoc = {
    slug,
    date,
    title,
    summary: "",
    occurredAt: Timestamp.fromDate(occurredAt),
    frames: [],
    coverage: {},
    status: "draft",
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  return slug;
}

export async function getEvent(slug: string): Promise<EventDoc> {
  const snap = await db.collection(EVENTS).doc(slug).get();
  if (!snap.exists) throw new Error(`사건을 찾지 못했습니다: ${slug}`);
  return snap.data() as EventDoc;
}

export async function updateEvent(slug: string, patch: Partial<EventDoc>): Promise<void> {
  await db
    .collection(EVENTS)
    .doc(slug)
    .update({ ...patch, updatedAt: Timestamp.now() });
}

export async function loadSources(): Promise<SourceDoc[]> {
  const snap = await db.collection(SOURCES).where("active", "==", true).get();
  return snap.docs
    .map((d) => d.data() as SourceDoc)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export interface ApplyCoverageResult {
  covered: number;
  silent: number;
  createdItems: number;
  attachedItems: number;
  truncated: boolean;
  calls: number;
  scanned: number;
}

/**
 * 보도 여부를 확인해 사건에 반영한다.
 *
 * 이 한 번으로 세 가지가 끝난다.
 *  1. 각 매체가 이 사건을 다뤘는지 판정 (coverage 맵)
 *  2. 발굴 단계에 없던 기사(네이버 전략 매체)를 items 에 적재
 *  3. 그 항목들을 사건에 배정
 *
 * truncated 면 '보도하지 않음' 을 쓸 수 없으므로 coverage 를 쓰지 않고 반환한다.
 */
export async function applyCoverage(
  slug: string,
  query: string,
  creds: NaverCredentials,
  windowHours: number,
): Promise<ApplyCoverageResult> {
  const event = await getEvent(slug);
  const sources = await loadSources();
  const occurredAt = event.occurredAt.toDate();
  const since = new Date(occurredAt.getTime() - 2 * 3_600_000);
  const until = new Date(occurredAt.getTime() + windowHours * 3_600_000);

  const targets: CoverageTarget[] = sources
    .filter((s) => s.domain)
    .map((s) => ({ sourceId: s.id, domain: s.domain! }));

  const outcome = await checkCoverage(targets, query, creds, since);

  if (outcome.truncated) {
    return {
      covered: 0,
      silent: 0,
      createdItems: 0,
      attachedItems: 0,
      truncated: true,
      calls: outcome.calls,
      scanned: outcome.scanned,
    };
  }

  const now = Timestamp.now();

  // 이전 실행에서 붙은 항목을 먼저 뗀다. 질의어를 바꿔 다시 돌리면 예전
  // 질의어로 걸린 기사가 그대로 남아, 사건에 다른 프레이밍의 기사가 섞인다.
  const previous = await db.collection(ITEMS).where("eventId", "==", slug).get();
  for (let i = 0; i < previous.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of previous.docs.slice(i, i + 400)) {
      batch.update(doc.ref, { eventId: null, frameKey: null });
    }
    await batch.commit();
  }

  const coverage: Record<string, CoverageEntry> = {};
  let createdItems = 0;
  let attachedItems = 0;

  for (const source of sources) {
    const hits = (outcome.covered.get(source.id) ?? []).filter(
      (h) => h.publishedAt <= until,
    );
    const first = hits[0];

    if (!first) {
      coverage[source.id] = { status: "none", checkedAt: now };
      continue;
    }

    // 발굴로 이미 들어온 기사면 그대로 쓰고, 없으면 지금 만든다.
    const itemId = itemIdFor(first.url);
    const ref = db.collection(ITEMS).doc(itemId);
    const snap = await ref.get();

    if (!snap.exists) {
      const doc: ItemDoc = {
        sourceId: source.id,
        title: first.title,
        url: first.url,
        publishedAt: Timestamp.fromDate(first.publishedAt),
        collectedAt: now,
        kind: "article",
        titleHistory: [{ title: first.title, observedAt: now }],
        status: "live",
        lastCheckedAt: now,
        eventId: slug,
        frameKey: null,
      };
      await ref.set(doc);
      createdItems++;
    } else {
      await ref.update({ eventId: slug });
    }
    attachedItems++;

    coverage[source.id] = {
      status: "covered",
      checkedAt: now,
      itemId,
      delayMinutes: Math.round(
        (first.publishedAt.getTime() - occurredAt.getTime()) / 60_000,
      ),
    };
  }

  // 프레임에서 이제 유효하지 않은 항목을 걷어낸다. 재실행하면 매체별로 고른
  // 기사가 바뀔 수 있는데, 그대로 두면 프레임이 사라진 항목을 가리켜
  // 개수와 실제 내용이 어긋난다.
  const validIds = new Set(
    Object.values(coverage)
      .map((c) => c.itemId)
      .filter((id): id is string => Boolean(id)),
  );
  const frames = event.frames
    .map((f) => ({ ...f, itemIds: f.itemIds.filter((id) => validIds.has(id)) }))
    .filter((f) => f.itemIds.length > 0);

  await updateEvent(slug, { coverage, coverageQuery: query, frames });

  const covered = Object.values(coverage).filter((c) => c.status === "covered").length;
  return {
    covered,
    silent: Object.keys(coverage).length - covered,
    createdItems,
    attachedItems,
    truncated: false,
    calls: outcome.calls,
    scanned: outcome.scanned,
  };
}

/**
 * 이 사건의 기사가 아닌 항목을 뺀다.
 *
 * coverage 는 매체별로 '질의어에 걸린 가장 이른 기사' 를 고른다. 질의어에
 * 걸렸다고 이 사건 기사인 것은 아니어서, 엉뚱한 기사가 최초 보도로 잡힐 수
 * 있다(실제로 YTN 의 다른 기사가 그렇게 걸렸다). 사람이 보고 빼야 한다.
 *
 * 뺀 매체는 '보도하지 않음' 으로 바뀐다. coverage 를 다시 돌리면 되살아나므로,
 * 뺀 뒤에는 다시 돌리지 않는다.
 */
export async function dropItem(slug: string, itemId: string): Promise<string> {
  const event = await getEvent(slug);
  const entry = Object.entries(event.coverage).find(([, c]) => c.itemId === itemId);
  if (!entry) throw new Error(`이 사건의 보도 항목이 아닙니다: ${itemId}`);
  const [sourceId] = entry;

  const coverage = { ...event.coverage };
  coverage[sourceId] = { status: "none", checkedAt: Timestamp.now() };

  const frames = event.frames
    .map((f) => ({ ...f, itemIds: f.itemIds.filter((id) => id !== itemId) }))
    .filter((f) => f.itemIds.length > 0);

  await updateEvent(slug, { coverage, frames });
  await db.collection(ITEMS).doc(itemId).update({ eventId: null, frameKey: null });
  return sourceId;
}

/** 사건에 배정된 항목을 매체 이름과 함께 읽는다. */
export async function loadEventItems(
  slug: string,
): Promise<Array<{ itemId: string; item: ItemDoc; sourceName: string }>> {
  const [itemsSnap, sources] = await Promise.all([
    db.collection(ITEMS).where("eventId", "==", slug).get(),
    loadSources(),
  ]);
  const names = new Map(sources.map((s) => [s.id, s.name] as const));

  return itemsSnap.docs
    .map((d) => ({
      itemId: d.id,
      item: d.data() as ItemDoc,
      sourceName: names.get((d.data() as ItemDoc).sourceId) ?? "?",
    }))
    .sort(
      (a, b) =>
        a.item.publishedAt.toDate().getTime() - b.item.publishedAt.toDate().getTime(),
    );
}

/** 발행 전에 반드시 통과해야 하는 검사. 통과하지 못하면 발행하지 않는다. */
export async function validateForPublish(slug: string): Promise<string[]> {
  const event = await getEvent(slug);
  const problems: string[] = [];

  if (!event.summary.trim()) problems.push("요약이 비어 있습니다.");
  if (Object.keys(event.coverage).length === 0) {
    problems.push("보도 여부를 확인하지 않았습니다 (coverage 명령).");
  }
  if (event.frames.length < 2) {
    problems.push(`프레임이 ${event.frames.length}개입니다. 최소 2개가 필요합니다.`);
  }

  const items = await loadEventItems(slug);
  const framed = new Set(event.frames.flatMap((f) => f.itemIds));
  const covered = Object.values(event.coverage).filter((c) => c.status === "covered");

  for (const c of covered) {
    if (c.itemId && !framed.has(c.itemId)) {
      const found = items.find((i) => i.itemId === c.itemId);
      problems.push(
        `프레임에 배정되지 않은 보도가 있습니다: ${found?.sourceName ?? c.itemId}`,
      );
    }
  }

  // 발생보다 먼저 나온 보도가 있다면 발생 시각이 틀렸거나 그 기사가 이 사건이
  // 아니다. 어느 쪽이든 지연 시간이 전부 틀어지므로 발행을 막는다.
  // 프레임이 사라진 항목을 가리키면 개수와 화면 내용이 어긋난다.
  const attached = new Set(items.map((i) => i.itemId));
  for (const frame of event.frames) {
    const dangling = frame.itemIds.filter((id) => !attached.has(id));
    if (dangling.length > 0) {
      problems.push(
        `프레임 "${frame.label}" 이 사라진 항목 ${dangling.length}건을 가리킵니다.`,
      );
    }
  }

  const early = covered.filter((c) => (c.delayMinutes ?? 0) < 0);
  if (early.length > 0) {
    const names = early
      .map((c) => items.find((i) => i.itemId === c.itemId)?.sourceName ?? "?")
      .join(", ");
    problems.push(
      `발생 시각보다 먼저 나온 보도가 ${early.length}건 있습니다 (${names}). ` +
        `발생 시각이 틀렸거나 이 사건의 기사가 아닙니다.`,
    );
  }

  return problems;
}
