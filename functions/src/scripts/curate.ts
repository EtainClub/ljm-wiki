/**
 * 큐레이션 CLI.
 *
 * 웹 admin 을 만들지 않는 이유는 설계서에 적어 뒀다 — 하루 1~3건에 UI 는
 * 과잉이고, 정적 사이트에 인증 화면을 붙이면 공격 표면만 늘어난다.
 *
 *   npm --prefix functions run curate -- list [키워드]
 *   npm --prefix functions run curate -- new "정부, 청년 주거 대책 발표" "2026-07-26 10:00"
 *   npm --prefix functions run curate -- set <id> summary "요약 문장"
 *   npm --prefix functions run curate -- coverage <id> "청년 주거 대책" [시간]
 *   npm --prefix functions run curate -- draft <id>
 *   npm --prefix functions run curate -- show <id>
 *   npm --prefix functions run curate -- publish <id>
 */

import { loadLocalEnv, requireEnv } from "../env";
import { ITEMS, db } from "../firebase";
import type { EventDoc, ItemDoc } from "../domain";
import {
  applyCoverage,
  attachItem,
  compareQueries,
  createEvent,
  deleteDraft,
  dropItem,
  findSilentCandidates,
  getEvent,
  kstDateString,
  loadEventItems,
  loadSources,
  parseKst,
  updateEvent,
  validateForPublish,
} from "../curate/events";
import { draftFrames } from "../frames/draft";
import { FieldPath, Timestamp } from "firebase-admin/firestore";

loadLocalEnv();

const kst = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

/** 음수는 발생 시각이 틀렸다는 신호다. 부호를 감추지 않는다. */
const formatDelay = (minutes: number): string =>
  minutes < 0 ? `발생 ${Math.abs(minutes)}분 전 ⚠` : `+${minutes}분`;

const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

/* ── list ────────────────────────────────────────────────── */

async function cmdList(keyword?: string): Promise<void> {
  const [snap, sources] = await Promise.all([
    db.collection(ITEMS).where("eventId", "==", null).get(),
    loadSources(),
  ]);
  const names = new Map(sources.map((s) => [s.id, s.name] as const));

  let rows = snap.docs
    .map((d) => ({ id: d.id, item: d.data() as ItemDoc }))
    .sort(
      (a, b) =>
        b.item.publishedAt.toDate().getTime() - a.item.publishedAt.toDate().getTime(),
    );

  if (keyword) rows = rows.filter((r) => r.item.title.includes(keyword));

  console.log(
    `미배정 ${snap.size}건` + (keyword ? ` · "${keyword}" 포함 ${rows.length}건` : ""),
  );
  console.log(`(최근 40건)\n`);

  for (const { id, item } of rows.slice(0, 40)) {
    console.log(
      `${id.slice(0, 8)}  ${kst(item.publishedAt.toDate())}  ` +
        `${(names.get(item.sourceId) ?? item.sourceId).padEnd(6)}  ${item.title}`,
    );
  }
}

/* ── new / set ───────────────────────────────────────────── */

async function cmdNew(title: string, occurredAtRaw: string): Promise<void> {
  const occurredAt = parseKst(occurredAtRaw);
  const slug = await createEvent(title, occurredAt);
  console.log(`사건 생성: ${slug}`);
  console.log(`  제목: ${title}`);
  console.log(`  발생: ${kst(occurredAt)} (KST)\n`);
  console.log(`다음:`);
  console.log(`  curate -- set ${slug} summary "요약 2~3문장"`);
  console.log(`  curate -- coverage ${slug} "질의어"`);
}

async function cmdSet(slug: string, field: string, value: string): Promise<void> {
  if (field === "summary") {
    await updateEvent(slug, { summary: value });
  } else if (field === "occurredAt") {
    // 지연 시간의 기준점이라 바꾸면 기존 coverage 의 delayMinutes 가 어긋난다.
    // date 도 함께 옮긴다 — 날짜가 바뀌는 수정(07-25 저녁 → 07-24 저녁)에서
    // date 만 남으면 위키와 사이트가 틀린 날짜를 표시한다.
    const at = parseKst(value);
    await updateEvent(slug, {
      occurredAt: Timestamp.fromDate(at),
      date: kstDateString(at),
    });
    console.log("⚠ 발생 시각을 바꿨습니다. coverage 를 다시 실행해야 지연 시간이 맞습니다.");
  } else if (field === "title") {
    await updateEvent(slug, { title: value });
  } else if (field === "wikiSlug") {
    await updateEvent(slug, { wikiSlug: value });
    console.log("위키 링크가 바뀝니다. wiki:outlets 를 다시 돌리고 기존 링크를 확인하세요.");
  } else {
    throw new Error(
      `알 수 없는 필드: ${field} (summary | occurredAt | title | wikiSlug)`,
    );
  }
  console.log(`${slug}.${field} 갱신됨`);
}

/* ── coverage ────────────────────────────────────────────── */

async function cmdCoverage(slug: string, query: string, hoursRaw?: string): Promise<void> {
  const hours = Number(hoursRaw ?? "48");
  const creds = {
    clientId: requireEnv("NAVER_CLIENT_ID"),
    clientSecret: requireEnv("NAVER_CLIENT_SECRET"),
  };

  console.log(`질의어 "${query}" · 발생 후 ${hours}시간 창\n`);
  const result = await applyCoverage(slug, query, creds, hours);

  if (result.truncated) {
    console.error(
      `⚠ 시간창을 다 훑지 못했습니다 (조회 ${result.scanned}건, 검색 ${result.calls}회).\n` +
        `  '보도하지 않음' 을 사실로 쓸 수 없어 coverage 를 저장하지 않았습니다.\n` +
        `  질의어를 좁히거나 시간창을 줄여 다시 실행하세요.`,
    );
    process.exit(1);
  }

  console.log(
    `보도 ${result.covered}곳 · 미보도 ${result.silent}곳\n` +
      `항목 신규 ${result.createdItems}건 · 사건 배정 ${result.attachedItems}건\n` +
      `조회 ${result.scanned}건 · 검색 ${result.calls}회 사용`,
  );
  console.log(`\n다음: curate -- draft ${slug}`);
}

/* ── draft ───────────────────────────────────────────────── */

async function cmdDraft(slug: string): Promise<void> {
  const event = await getEvent(slug);
  const items = await loadEventItems(slug);

  if (items.length === 0) {
    throw new Error("배정된 항목이 없습니다. coverage 를 먼저 실행하세요.");
  }

  console.log(`제목 ${items.length}건으로 프레임 초안을 만듭니다...\n`);

  const draft = await draftFrames({
    eventTitle: event.title,
    eventSummary: event.summary,
    occurredAt: hhmm(event.occurredAt.toDate()),
    candidates: items.map((i) => ({
      itemId: i.itemId,
      sourceName: i.sourceName,
      title: i.item.title,
      publishedAt: hhmm(i.item.publishedAt.toDate()),
    })),
  });

  await updateEvent(slug, {
    frames: draft.frames.map((f) => ({
      key: f.key,
      label: f.label,
      note: f.note,
      itemIds: f.itemIds,
    })),
  });

  const byId = new Map(items.map((i) => [i.itemId, i] as const));
  for (const frame of draft.frames) {
    console.log(`■ ${frame.label}  (${frame.itemIds.length})`);
    console.log(`  ${frame.note}`);
    for (const id of frame.itemIds) {
      const it = byId.get(id);
      if (it) console.log(`  - ${it.sourceName}: ${it.item.title}`);
    }
    console.log();
  }

  if (draft.unassignedItemIds.length > 0) {
    console.log(`■ 미배정 ${draft.unassignedItemIds.length}건`);
    for (const id of draft.unassignedItemIds) {
      const it = byId.get(id);
      if (it) console.log(`  - ${it.sourceName}: ${it.item.title}`);
    }
    console.log();
  }

  if (draft.warnings.length > 0) {
    console.log(`⚠ 검수 경고 ${draft.warnings.length}건`);
    for (const w of draft.warnings) console.log(`  - ${w}`);
    console.log();
  }

  console.log(`초안을 저장했습니다. 반드시 눈으로 확인한 뒤 발행하세요.`);
  console.log(`  curate -- show ${slug}`);
}

/* ── frame (수동) ────────────────────────────────────────── */

/**
 * 프레임을 직접 만든다.
 *
 * draft 는 초안일 뿐이고 확정은 사람이 한다 — 그러면 LLM 없이도 사건을
 * 완성할 수 있어야 한다. API 키가 없거나 초안이 틀렸을 때 쓴다.
 */
async function cmdFrame(
  slug: string,
  key: string,
  label: string,
  itemIds: string[],
): Promise<void> {
  const event = await getEvent(slug);
  const items = await loadEventItems(slug);
  const known = new Map(items.map((i) => [i.itemId, i] as const));

  // 앞 8자리만 입력해도 되게 한다. 터미널에서 20자리를 옮겨 적는 건 고역이다.
  const resolved: string[] = [];
  for (const raw of itemIds) {
    const matches = [...known.keys()].filter((id) => id.startsWith(raw));
    if (matches.length === 0) throw new Error(`이 사건에 없는 항목입니다: ${raw}`);
    if (matches.length > 1) throw new Error(`앞자리가 겹칩니다: ${raw} (${matches.length}건)`);
    resolved.push(matches[0]!);
  }

  // 다른 프레임에 이미 있으면 옮긴다 — 한 항목은 한 곳에만 속한다.
  const frames = event.frames
    .map((f) => ({ ...f, itemIds: f.itemIds.filter((id) => !resolved.includes(id)) }))
    .filter((f) => f.key === key || f.itemIds.length > 0);

  const existing = frames.find((f) => f.key === key);
  if (existing) {
    existing.label = label;
    existing.itemIds = resolved;
  } else {
    frames.push({ key, label, itemIds: resolved });
  }

  await updateEvent(slug, { frames: frames.filter((f) => f.itemIds.length > 0) });

  console.log(`■ ${label}  (${resolved.length})`);
  for (const id of resolved) {
    const it = known.get(id)!;
    console.log(`  - ${it.sourceName}: ${it.item.title}`);
  }
}

/** 배정되지 않은 항목을 보여준다. 프레임을 손으로 짤 때 쓴다. */
async function cmdPending(slug: string): Promise<void> {
  const event = await getEvent(slug);
  const items = await loadEventItems(slug);
  const framed = new Set(event.frames.flatMap((f) => f.itemIds));
  const pending = items.filter((i) => !framed.has(i.itemId));

  console.log(`프레임 미배정 ${pending.length}건 / 전체 ${items.length}건\n`);
  for (const it of pending) {
    console.log(
      `${it.itemId.slice(0, 8)}  ${hhmm(it.item.publishedAt.toDate())}  ` +
        `${it.sourceName.padEnd(6)}  ${it.item.title}`,
    );
  }
}

/* ── 판정 신뢰도 ─────────────────────────────────────────── */

/**
 * 미보도로 찍힌 매체의 기사가 우리 저장소에 있는지 훑는다.
 *
 * 붙이지는 않는다 — 제목이 겹친다고 같은 사건이라는 보장이 없다.
 * 사람이 보고 `curate attach` 로 붙인다.
 */
async function cmdSilent(slug: string, hoursRaw?: string): Promise<void> {
  const hours = Number(hoursRaw ?? "48");
  const { candidates, silentCount, query } = await findSilentCandidates(slug, hours);

  console.log(`질의어 "${query}" · 미보도 ${silentCount}곳 · 창 ${hours}시간\n`);

  if (silentCount === 0) {
    console.log("미보도 매체가 없습니다.");
    return;
  }
  if (candidates.length === 0) {
    console.log(
      "저장소에도 후보가 없습니다. '보도하지 않음' 을 뒤집을 근거가 우리 손에 없습니다.",
    );
    return;
  }

  console.log(`저장소에서 찾은 후보 ${candidates.length}건 — 검색이 놓쳤을 수 있습니다.\n`);
  for (const c of candidates) {
    console.log(
      `${c.itemId.slice(0, 8)}  ${hhmm(c.publishedAt)}  낱말 ${c.hits}개  ` +
        `${c.sourceName.padEnd(6)}  ${c.title}`,
    );
    // 호스트를 반드시 같이 찍는다. 매체 id 만 보고 붙였다가 MBN 기사를
    // 매일경제로 기록한 적이 있다.
    console.log(`          ${c.host}`);
  }
  console.log(
    `\n붙이기 전에 위 호스트와 제목이 이 사건 기사가 맞는지 확인하세요.\n` +
      `  curate -- attach ${slug} <항목>`,
  );
}

/**
 * 질의어를 바꿔 가며 보도 여부가 흔들리는 매체를 찾는다. 아무것도 쓰지 않는다.
 */
async function cmdCompare(
  slug: string,
  queries: string[],
  hoursRaw?: string,
): Promise<void> {
  const hours = Number(hoursRaw ?? "48");
  const creds = {
    clientId: requireEnv("NAVER_CLIENT_ID"),
    clientSecret: requireEnv("NAVER_CLIENT_SECRET"),
  };
  const sources = await loadSources();
  const names = new Map(sources.map((s) => [s.id, s.name] as const));

  console.log(`질의어 ${queries.length}개 · 창 ${hours}시간\n`);
  const r = await compareQueries(slug, queries, creds, hours);

  const best = Math.max(...r.byQuery.map((q) => q.covered.size));
  for (const q of r.byQuery) {
    // 아무것도 못 잡는 질의어는 매체가 흔들린다는 신호가 아니라 질의어가 틀렸다는 신호다.
    const weak = q.covered.size === 0 || q.covered.size * 2 < best;
    console.log(
      `  "${q.query}"  → 보도 ${q.covered.size}곳 (조회 ${q.scanned}건)` +
        (weak ? "  ⚠ 너무 좁습니다" : ""),
    );
  }
  console.log();

  if (r.truncated) {
    console.error("⚠ 한 질의어 이상에서 시간창을 다 훑지 못했습니다. 결과를 믿을 수 없습니다.");
    process.exit(1);
  }

  // 검사 대상은 '보도하지 않음' 뿐이다. '보도했다' 는 우리가 주장하는 사실이 아니라
  // 관측이므로, 어떤 질의어가 놓쳤다고 해서 틀린 기록이 되지 않는다.
  console.log(`지금 '보도하지 않음' 으로 기록된 곳 ${r.storedSilent.length}곳`);
  console.log(
    `  ${r.storedSilent.map((id) => names.get(id) ?? id).join(", ") || "(없음)"}`,
  );
  if (r.dropped.length > 0) {
    console.log(
      `  그중 ${r.dropped.length}곳은 사람이 '이 사건 기사가 아니다' 라고 뺀 것입니다 — 검사하지 않습니다.\n` +
        `  (${r.dropped.map((id) => names.get(id) ?? id).join(", ")})`,
    );
  }
  console.log();

  if (r.falseSilent.length === 0) {
    console.log("■ 뒤집힌 곳 없음");
    console.log(
      "  어느 질의어로도 이 매체들의 기사를 찾지 못했습니다.\n" +
        "  '보도하지 않음' 판정이 질의어를 바꿔도 버팁니다.",
    );
    return;
  }

  console.log(`■ 잘못된 '보도하지 않음' ${r.falseSilent.length}곳`);
  for (const u of r.falseSilent) {
    console.log(
      `  ${(names.get(u.sourceId) ?? u.sourceId).padEnd(6)} — 이 질의어에서는 보도로 잡힘: ` +
        u.coveredIn.map((q) => `"${q}"`).join(", "),
    );
  }
  console.log(
    `\n사이트에 실린 사실이 틀렸다는 뜻입니다. 둘 중 하나를 하세요.\n` +
      `  - 더 넓은 질의어로 coverage 를 다시 돌린다\n` +
      `  - curate -- silent 로 저장소의 기사를 찾아 attach 한다`,
  );
}

/* ── show / publish ──────────────────────────────────────── */

async function cmdShow(slug: string): Promise<void> {
  const event = await getEvent(slug);
  const items = await loadEventItems(slug);
  const sources = await loadSources();
  const names = new Map(sources.map((s) => [s.id, s.name] as const));
  const byId = new Map(items.map((i) => [i.itemId, i] as const));

  console.log(`${slug}  [${event.status}]`);
  console.log(`제목: ${event.title}`);
  console.log(`요약: ${event.summary || "(비어 있음)"}`);
  console.log(`발생: ${kst(event.occurredAt.toDate())} (KST)`);
  if (event.coverageQuery) console.log(`질의어: "${event.coverageQuery}"`);
  console.log();

  for (const frame of event.frames) {
    console.log(`■ ${frame.label}  (${frame.itemIds.length})`);
    if (frame.note) console.log(`  ${frame.note}`);
    for (const id of frame.itemIds) {
      const it = byId.get(id);
      const delay = event.coverage[it?.item.sourceId ?? ""]?.delayMinutes;
      if (it) {
        // 항목 id 를 같이 찍는다 — frame/drop 으로 고치려면 참조할 수 있어야 한다.
        console.log(
          `  ${it.itemId.slice(0, 8)}  ${hhmm(it.item.publishedAt.toDate())}` +
            (typeof delay === "number" ? ` (${formatDelay(delay)})` : "") +
            `  ${it.sourceName}: ${it.item.title}`,
        );
      }
    }
    console.log();
  }

  const silent = Object.entries(event.coverage)
    .filter(([, c]) => c.status === "none")
    .map(([id]) => names.get(id) ?? id);
  console.log(`■ 보도하지 않음 ${silent.length}곳`);
  if (silent.length > 0) console.log(`  ${silent.join(", ")}`);

  const problems = await validateForPublish(slug);
  console.log();
  if (problems.length === 0) {
    console.log(`✓ 발행 가능: curate -- publish ${slug}`);
  } else {
    console.log(`발행 전 해결할 것 ${problems.length}건`);
    for (const p of problems) console.log(`  - ${p}`);
  }
}

async function cmdPublish(slug: string): Promise<void> {
  const problems = await validateForPublish(slug);
  if (problems.length > 0) {
    console.error(`발행할 수 없습니다:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  await updateEvent(slug, {
    status: "published",
    publishedAt: Timestamp.now(),
  } as Partial<EventDoc>);

  console.log(`발행했습니다: ${slug}`);
  console.log(`\n정적 사이트는 재빌드해야 반영됩니다:`);
  console.log(`  FIREBASE_PROJECT_ID=new-ljm npm run build`);
}

/**
 * 접두사 범위 질의의 끝. 사용자 영역 최상단 코드포인트(U+F8FF)라
 * 같은 접두사를 가진 어느 id 보다도 뒤에 온다.
 *
 * 문자를 그대로 박지 않는다 — 화면에 아무것도 보이지 않아
 * `>= p` AND `< p` 라는 빈 범위로 오해하기 딱 좋다. 눈에 보이게 적는다.
 */
const ID_RANGE_END = String.fromCharCode(0xf8ff);

/**
 * 후보 풀 전체에서 항목 id 앞자리로 하나를 찾는다.
 *
 * drop 은 사건에 붙은 항목만 보면 되지만 attach 는 아직 안 붙은 것을 찾아야 한다.
 * 문서 id 범위 질의로 접두사를 훑는다.
 */
async function resolvePoolItem(prefix: string): Promise<{ id: string; item: ItemDoc }> {
  const snap = await db
    .collection(ITEMS)
    .where(FieldPath.documentId(), ">=", prefix)
    .where(FieldPath.documentId(), "<", prefix + ID_RANGE_END)
    .limit(5)
    .get();

  if (snap.empty) throw new Error(`없는 항목입니다: ${prefix}`);
  if (snap.size > 1) throw new Error(`앞자리가 겹칩니다: ${prefix} (${snap.size}건)`);
  return { id: snap.docs[0]!.id, item: snap.docs[0]!.data() as ItemDoc };
}

/* ── dispatch ────────────────────────────────────────────── */

const USAGE = `사용법:
  curate -- list [키워드]
  curate -- new "<제목>" "<발생시각 KST, 예: 2026-07-26 10:00>"
  curate -- set <id> <summary|occurredAt|title> "<값>"
  curate -- coverage <id> "<질의어>" [시간=48]
  curate -- draft <id>                       LLM 초안 (ANTHROPIC_API_KEY 필요)
  curate -- pending <id>                     프레임 미배정 항목 보기
  curate -- frame <id> <키> "<라벨>" <항목...>  프레임 직접 지정
  curate -- drop <id> <항목>                  이 사건 기사가 아닌 항목 빼기
  curate -- attach <id> <항목>                검색이 놓친 기사를 보도로 붙이기
  curate -- silent <id> [시간=48]             미보도 매체의 기사가 저장소에 있는지 훑기
  curate -- compare <id> "<질의어1>" "<질의어2>" [...]  질의어에 따라 갈리는 매체 찾기
  curate -- show <id>
  curate -- publish <id>
  curate -- delete <id>                      초안 삭제 (발행분은 불가)`;

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case "list":
      return cmdList(args[0]);
    case "new":
      if (!args[0] || !args[1]) throw new Error(USAGE);
      return cmdNew(args[0], args[1]);
    case "set":
      if (!args[0] || !args[1] || args[2] === undefined) throw new Error(USAGE);
      return cmdSet(args[0], args[1], args[2]);
    case "coverage":
      if (!args[0] || !args[1]) throw new Error(USAGE);
      return cmdCoverage(args[0], args[1], args[2]);
    case "draft":
      if (!args[0]) throw new Error(USAGE);
      return cmdDraft(args[0]);
    case "pending":
      if (!args[0]) throw new Error(USAGE);
      return cmdPending(args[0]);
    case "frame":
      if (!args[0] || !args[1] || !args[2] || args.length < 4) throw new Error(USAGE);
      return cmdFrame(args[0], args[1], args[2], args.slice(3));
    case "show":
      if (!args[0]) throw new Error(USAGE);
      return cmdShow(args[0]);
    case "publish":
      if (!args[0]) throw new Error(USAGE);
      return cmdPublish(args[0]);
    case "drop": {
      if (!args[0] || !args[1]) throw new Error(USAGE);
      const items = await loadEventItems(args[0]);
      const matches = items.filter((i) => i.itemId.startsWith(args[1]!));
      if (matches.length !== 1) {
        throw new Error(
          matches.length === 0
            ? `이 사건에 없는 항목입니다: ${args[1]}`
            : `앞자리가 겹칩니다: ${args[1]} (${matches.length}건)`,
        );
      }
      const sourceId = await dropItem(args[0], matches[0]!.itemId);
      console.log(
        `뺐습니다: ${matches[0]!.sourceName} — ${matches[0]!.item.title}\n` +
          `${sourceId} 는 '보도하지 않음' 으로 바뀝니다. ` +
          `coverage 를 다시 돌리면 되살아납니다.`,
      );
      return;
    }
    case "attach": {
      if (!args[0] || !args[1]) throw new Error(USAGE);
      const { id, item } = await resolvePoolItem(args[1]);
      const r = await attachItem(args[0], id);
      console.log(
        `붙였습니다: ${r.sourceId} — ${item.title}\n` +
          `  ${formatDelay(r.delayMinutes)} · 항목 ${id.slice(0, 8)}\n` +
          `coverage 를 다시 돌리면 지워집니다. frame 으로 배정하세요.`,
      );
      return;
    }
    case "silent":
      if (!args[0]) throw new Error(USAGE);
      return cmdSilent(args[0], args[1]);
    case "compare": {
      if (!args[0] || !args[1] || !args[2]) throw new Error(USAGE);
      // 마지막 인자가 숫자면 시간창이다. 아니면 전부 질의어다.
      const rest = args.slice(1);
      const last = rest[rest.length - 1]!;
      const hours = /^\d+$/.test(last) ? rest.pop() : undefined;
      if (rest.length < 2) throw new Error("질의어를 2개 이상 주세요.");
      return cmdCompare(args[0], rest, hours);
    }
    case "delete":
      if (!args[0]) throw new Error(USAGE);
      await deleteDraft(args[0]);
      console.log(`초안을 지웠습니다: ${args[0]} (항목은 후보 풀로 되돌렸습니다)`);
      return;
    default:
      console.log(USAGE);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
