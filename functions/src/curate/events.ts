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
    .map((s) => ({
      sourceId: s.id,
      domain: s.domain!,
      ...(s.excludeHosts ? { excludeHosts: s.excludeHosts } : {}),
    }));

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

    // 이른 것부터 보되, 이미 다른 사건의 기사인 것은 건너뛴다.
    //
    // 한 기사는 한 사건에만 속한다. 그냥 덮어쓰면 앞선 사건에서 그 기사가
    // 빠져나가고, 그쪽 coverage 는 여전히 '보도' 라고 말하는데 실제 항목은
    // 사라진 상태가 된다 — 실제로 사건 1이 이렇게 3건을 잃었다.
    let chosen: { hit: (typeof hits)[number]; itemId: string; exists: boolean } | null =
      null;
    for (const hit of hits) {
      const itemId = itemIdFor(hit.url);
      const snap = await db.collection(ITEMS).doc(itemId).get();
      const owner = snap.exists ? (snap.data() as ItemDoc).eventId : null;
      if (owner && owner !== slug) continue; // 다른 사건 소유
      chosen = { hit, itemId, exists: snap.exists };
      break;
    }

    if (!chosen) {
      coverage[source.id] = { status: "none", checkedAt: now, reason: "not_found" };
      continue;
    }

    const { hit: first, itemId } = chosen;
    const ref = db.collection(ITEMS).doc(itemId);

    // 발굴로 이미 들어온 기사면 그대로 쓰고, 없으면 지금 만든다.
    if (!chosen.exists) {
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
  coverage[sourceId] = {
    status: "none",
    checkedAt: Timestamp.now(),
    reason: "dropped",
  };

  const frames = event.frames
    .map((f) => ({ ...f, itemIds: f.itemIds.filter((id) => id !== itemId) }))
    .filter((f) => f.itemIds.length > 0);

  await updateEvent(slug, { coverage, frames });
  await db.collection(ITEMS).doc(itemId).update({ eventId: null, frameKey: null });
  return sourceId;
}

/**
 * 이미 수집해 둔 항목을 이 사건의 보도로 직접 붙인다.
 *
 * 왜 필요한가 — coverage 는 네이버 검색만 본다. 그런데 우리는 RSS 로 따로
 * 수집한 기사를 이미 갖고 있고, 네이버 검색이 그걸 돌려주지 않는 경우가 있다.
 * 실제로 동아일보의 「與, 보완수사권 폐지 당론 채택…」 기사가 그랬다 —
 * 저장소에 있는데도 검색에는 안 잡혀 '보도하지 않음' 으로 찍혔다.
 *
 * '보도하지 않음' 은 사이트에 사실로 실린다. 우리 손에 반증이 있는데 그대로
 * 두는 것은 틀린 기록이므로, 사람이 보고 붙일 수 있어야 한다.
 *
 * coverage 를 다시 돌리면 이 배정은 지워진다 — 붙인 뒤에는 다시 돌리지 않는다.
 */
export async function attachItem(
  slug: string,
  itemId: string,
): Promise<{ sourceId: string; title: string; delayMinutes: number }> {
  const event = await getEvent(slug);
  const ref = db.collection(ITEMS).doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`없는 항목입니다: ${itemId}`);

  const item = snap.data() as ItemDoc;
  if (item.eventId && item.eventId !== slug) {
    throw new Error(`이미 다른 사건에 붙어 있습니다: ${item.eventId}`);
  }

  const existing = event.coverage[item.sourceId];
  if (existing?.status === "covered" && existing.itemId !== itemId) {
    throw new Error(
      `${item.sourceId} 는 이미 다른 기사로 보도 처리돼 있습니다: ${existing.itemId}`,
    );
  }

  const delayMinutes = Math.round(
    (item.publishedAt.toDate().getTime() - event.occurredAt.toDate().getTime()) / 60_000,
  );

  const coverage = { ...event.coverage };
  coverage[item.sourceId] = {
    status: "covered",
    checkedAt: Timestamp.now(),
    itemId,
    delayMinutes,
  };

  await updateEvent(slug, { coverage });
  await ref.update({ eventId: slug });

  return { sourceId: item.sourceId, title: item.title, delayMinutes };
}

export interface QueryComparison {
  /** 질의어별로 보도로 판정된 매체 */
  byQuery: Array<{ query: string; covered: Set<string>; scanned: number; calls: number }>;
  /** 지금 이 사건에 '보도하지 않음' 으로 저장돼 있는 매체 */
  storedSilent: string[];
  /**
   * 그중 다른 질의어에서는 보도로 잡힌 매체. **이것이 이 명령의 요점이다** —
   * 사이트에 실린 '보도하지 않음' 이 사실이 아니라는 뜻이기 때문이다.
   */
  falseSilent: Array<{ sourceId: string; coveredIn: string[] }>;
  /** 어느 질의어로도 안 잡힌 매체. 미보도 판정이 버틴다. */
  confirmedSilent: string[];
  /** 사람이 '이 사건 기사가 아니다' 라고 뺀 매체. 검사 대상이 아니다. */
  dropped: string[];
  truncated: boolean;
}

/**
 * 같은 사건·같은 시간창에 질의어만 바꿔 보도 여부를 견준다.
 *
 * 왜 필요한가 — 2026-07-24 보완수사권 당론 사건에서 질의어를 바꾸자 미보도가
 * 6곳에서 0곳이 됐다. '보도하지 않음' 은 실존 매체에 대한 사실 주장으로
 * 사이트에 실리는데, 그 값이 우리가 고른 문자열에 좌우된다는 뜻이다.
 *
 * 아무것도 쓰지 않는다. 어느 매체의 판정이 흔들리는지 보여줄 뿐이다 —
 * 흔들리는 매체를 발행 전에 사람이 알아야 한다.
 */
export async function compareQueries(
  slug: string,
  queries: string[],
  creds: NaverCredentials,
  windowHours: number,
): Promise<QueryComparison> {
  const event = await getEvent(slug);
  const sources = await loadSources();
  const occurredAt = event.occurredAt.toDate();
  const since = new Date(occurredAt.getTime() - 2 * 3_600_000);
  const until = new Date(occurredAt.getTime() + windowHours * 3_600_000);

  const targets: CoverageTarget[] = sources
    .filter((s) => s.domain)
    .map((s) => ({
      sourceId: s.id,
      domain: s.domain!,
      ...(s.excludeHosts ? { excludeHosts: s.excludeHosts } : {}),
    }));

  const byQuery: QueryComparison["byQuery"] = [];
  let truncated = false;

  for (const query of queries) {
    const outcome = await checkCoverage(targets, query, creds, since);
    if (outcome.truncated) truncated = true;

    const covered = new Set<string>();
    for (const [sourceId, hits] of outcome.covered) {
      if (hits.some((h) => h.publishedAt <= until)) covered.add(sourceId);
    }
    byQuery.push({
      query,
      covered,
      scanned: outcome.scanned,
      calls: outcome.calls,
    });
  }

  // '보도했다' 가 질의어에 따라 흔들리는 것은 문제가 아니다 — 우리는 그 매체가
  // 보도하지 않았다고 주장하지 않기 때문이다. 위험한 것은 반대 방향뿐이다:
  // 지금 '보도하지 않음' 이라고 사이트에 적혀 있는데 다른 질의어로는 잡히는 경우.
  const storedSilent = Object.entries(event.coverage)
    .filter(([, c]) => c.status === "none")
    .map(([id]) => id);

  const falseSilent: QueryComparison["falseSilent"] = [];
  const confirmedSilent: string[] = [];
  const dropped: string[] = [];

  for (const sourceId of storedSilent) {
    // 사람이 보고 뺀 것은 검사 대상이 아니다. 검색이 다시 찾아내는 건 당연하고,
    // 그걸 '잘못된 미보도' 라고 하면 운영자의 판단을 매번 뒤집으라고 하는 셈이다.
    if (event.coverage[sourceId]?.reason === "dropped") {
      dropped.push(sourceId);
      continue;
    }
    const coveredIn = byQuery.filter((q) => q.covered.has(sourceId)).map((q) => q.query);
    if (coveredIn.length > 0) falseSilent.push({ sourceId, coveredIn });
    else confirmedSilent.push(sourceId);
  }

  return { byQuery, storedSilent, falseSilent, confirmedSilent, dropped, truncated };
}

/**
 * '보도하지 않음' 으로 찍힌 매체에 대해, **우리 저장소 안에** 후보 기사가 있는지 찾는다.
 *
 * coverage 는 네이버 검색만 본다. 그런데 RSS 로 따로 수집해 둔 기사가 검색에
 * 안 잡히는 경우가 실재한다 — 동아일보의 당론 추인 기사가 그랬다. 그때는
 * 우리 손에 반증이 있는데도 '보도하지 않음' 이 사이트에 사실로 실린다.
 *
 * 자동으로 붙이지 않는다. 제목이 겹친다고 같은 사건이라는 보장이 없기 때문이다.
 * 사람이 보고 `curate attach` 로 붙인다 — 이 함수는 '눈치채야만 잡히던' 것을
 * '목록으로 들이미는' 것으로 바꿀 뿐이다.
 */
export interface SilentCandidate {
  sourceId: string;
  sourceName: string;
  itemId: string;
  title: string;
  /** 사람이 눈으로 확인할 수 있게 호스트를 같이 준다 */
  host: string;
  publishedAt: Date;
  /** 질의어와 겹친 낱말 수 */
  hits: number;
}

/**
 * 질의어를 낱말로 쪼갠다. 한 글자짜리는 아무 데나 걸리므로 뺀다.
 *
 * NFC 로 정규화한다 — 같은 「李」가 U+674E 와 U+F9E1 두 가지로 오고,
 * 한국 언론사 절반이 호환 한자(U+F9E1)를 쓴다. 정규화하지 않으면 조용히 놓친다.
 */
function queryTokens(query: string): string[] {
  return [
    ...new Set(
      query
        .normalize("NFC")
        .split(/\s+/)
        .filter((t) => t.length >= 2),
    ),
  ];
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function findSilentCandidates(
  slug: string,
  windowHours: number,
): Promise<{ candidates: SilentCandidate[]; silentCount: number; query: string }> {
  const event = await getEvent(slug);
  const query = event.coverageQuery ?? "";
  const tokens = queryTokens(query);

  const silent = Object.entries(event.coverage)
    .filter(([, c]) => c.status === "none")
    .map(([id]) => id);

  if (silent.length === 0 || tokens.length === 0) {
    return { candidates: [], silentCount: silent.length, query };
  }

  const occurredAt = event.occurredAt.toDate();
  const from = Timestamp.fromDate(new Date(occurredAt.getTime() - 2 * 3_600_000));
  const to = Timestamp.fromDate(
    new Date(occurredAt.getTime() + windowHours * 3_600_000),
  );

  const sources = await loadSources();
  const names = new Map(sources.map((s) => [s.id, s.name] as const));
  const excluded = new Map(sources.map((s) => [s.id, s.excludeHosts ?? []] as const));

  const snap = await db
    .collection(ITEMS)
    .where("publishedAt", ">=", from)
    .where("publishedAt", "<=", to)
    .get();

  const out: SilentCandidate[] = [];
  for (const doc of snap.docs) {
    const item = doc.data() as ItemDoc;
    if (!silent.includes(item.sourceId)) continue;
    if (item.eventId) continue; // 이미 다른 사건 것이다

    // 매체 id 는 붙어 있지만 실제로는 다른 매체인 기사가 후보 풀에 남아 있다.
    // excludeHosts 가 생기기 전에 수집된 MBN 기사가 매일경제 id 를 달고 있다.
    // 여기서 거르지 않으면 이 도구가 그 오류를 다시 붙이라고 권한다 — 실제로 그랬다.
    const host = hostOf(item.url);
    const bad = excluded.get(item.sourceId) ?? [];
    if (bad.some((h) => host === h || host.endsWith(`.${h}`))) continue;

    const title = item.title.normalize("NFC");
    const hits = tokens.filter((t) => title.includes(t)).length;
    if (hits === 0) continue;

    out.push({
      sourceId: item.sourceId,
      sourceName: names.get(item.sourceId) ?? item.sourceId,
      itemId: doc.id,
      title: item.title,
      host,
      publishedAt: item.publishedAt.toDate(),
      hits,
    });
  }

  // 많이 겹친 것부터, 같으면 이른 것부터.
  out.sort((a, b) => b.hits - a.hits || a.publishedAt.getTime() - b.publishedAt.getTime());
  return { candidates: out, silentCount: silent.length, query };
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
