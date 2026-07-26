/**
 * Firestore 항목을 위키의 불변 원본(sources/)으로 내보낸다.
 *
 *   npm --prefix functions run export:sources -- --event 2026-07-25-acedae
 *   npm --prefix functions run export:sources -- --since 2026-07-25 --match 이재명,정성호
 *
 * 왜 파일로 빼는가 — ingest 는 Anthropic API 가 아니라 저장소에서 동작하는
 * 코딩 에이전트가 한다(Karpathy 방식). 에이전트가 읽을 수 있어야 하고,
 * 원본이 git 에 있어야 나중에 "그때 무엇을 보고 썼는가" 를 되짚을 수 있다.
 *
 * 이미 있는 파일은 덮어쓰지 않는다. 원본은 불변이다.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ITEMS, db } from "../firebase";
import type { ItemDoc } from "../domain";
import { loadSources } from "../curate/events";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SOURCES_DIR = join(REPO_ROOT, "sources");

const kstDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const kstIso = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}+09:00`;
};

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1] ?? "";
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sources = await loadSources();
  const names = new Map(sources.map((s) => [s.id, s.name] as const));

  let docs;
  if (args["event"]) {
    docs = (await db.collection(ITEMS).where("eventId", "==", args["event"]).get()).docs;
  } else if (args["since"]) {
    const since = new Date(`${args["since"]}T00:00:00+09:00`);
    docs = (await db.collection(ITEMS).where("publishedAt", ">=", since).get()).docs;
  } else {
    console.error(
      "사용법: export:sources -- --event <슬러그>  |  --since <YYYY-MM-DD> [--match 이름,이름]",
    );
    process.exit(1);
  }

  // --match 는 이재명 필터의 수동 버전이다. 위키가 자라면 people/ 목록이 대신한다.
  const match = (args["match"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  let rows = docs.map((d) => ({ id: d.id, item: d.data() as ItemDoc }));
  if (match.length > 0) {
    rows = rows.filter((r) => match.some((m) => r.item.title.includes(m)));
  }

  rows.sort(
    (a, b) =>
      a.item.publishedAt.toDate().getTime() - b.item.publishedAt.toDate().getTime(),
  );

  let written = 0;
  let skipped = 0;

  for (const { id, item } of rows) {
    const published = item.publishedAt.toDate();
    const dir = join(SOURCES_DIR, kstDate(published));
    mkdirSync(dir, { recursive: true });

    const path = join(dir, `${item.sourceId}-${id.slice(0, 8)}.md`);
    if (existsSync(path)) {
      skipped++;
      continue;
    }

    // 제목·링크·시각·매체만 담는다. 본문은 수집하지 않으므로 쓸 것이 없다.
    const body = [
      "---",
      `id: ${id}`,
      `outlet: ${item.sourceId}`,
      `outletName: ${names.get(item.sourceId) ?? item.sourceId}`,
      `publishedAt: ${kstIso(published)}`,
      `url: ${item.url}`,
      ...(item.eventId ? [`event: ${item.eventId}`] : []),
      ...(item.titleHistory.length > 1 ? [`titleChanged: true`] : []),
      "---",
      "",
      `# ${item.title}`,
      "",
      ...(item.titleHistory.length > 1
        ? [
            "## 제목 변경 이력",
            ...item.titleHistory.map(
              (h) => `- ${kstIso(h.observedAt.toDate())} 「${h.title}」`,
            ),
            "",
          ]
        : []),
    ].join("\n");

    writeFileSync(path, body, "utf8");
    written++;
  }

  console.log(
    `원본 ${written}건 기록 · ${skipped}건 이미 존재(건너뜀)\n` +
      `위치: sources/\n\n` +
      `다음: Claude Code 를 이 저장소에서 열고 "wiki/schema.md 를 읽고 sources/ 를 ingest 해줘" 라고 하세요.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
