import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** 사건별 승인 입력. 공통 파일의 변경분 대신 이 파일만 PR에 넣는다. */
export interface IngestRecord {
  version: 1;
  eventId: string;
  wikiSlug: string;
  title: string;
  recordedOn: string;
  people: string[];
  log: string;
}

export const RECORD_DIR = ".automation/ingest-records";
const EVENT_ID = /^\d{4}-\d{2}-\d{2}-[a-f0-9]{6}$/;
const component = (s: string): boolean => Boolean(s) && !/[\\/\r\n]/.test(s) && s !== "." && s !== "..";

export function readRecords(root: string): IngestRecord[] {
  const dir = join(root, RECORD_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort().map((name) => {
    const record = JSON.parse(readFileSync(join(dir, name), "utf8")) as IngestRecord;
    if (record.version !== 1 || !EVENT_ID.test(record.eventId) || name !== `${record.eventId}.json` ||
        !component(record.wikiSlug) || typeof record.title !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(record.recordedOn) ||
        !Array.isArray(record.people) || !record.people.every((p) => typeof p === "string" && component(p)) ||
        typeof record.log !== "string") {
      throw new Error(`잘못된 ingest record: ${name}`);
    }
    if (!existsSync(join(root, "wiki/events", `${record.wikiSlug}.md`))) {
      throw new Error(`사건 위키 없음: ${record.wikiSlug}`);
    }
    return record;
  });
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? markdownFiles(join(dir, entry.name)) : entry.name.endsWith(".md") ? [join(dir, entry.name)] : [],
  );
}

/** 수동 설명은 보존하고, 현재 파일 집합으로 공통 목록과 산수를 다시 만든다. DB 불필요. */
export function generateCatalog(root: string): void {
  const records = readRecords(root);
  const wiki = join(root, "wiki");
  for (const record of records) {
    for (const name of record.people) {
      const file = join(wiki, "people", `${name}.md`);
      if (existsSync(file)) continue;
      mkdirSync(join(wiki, "people"), { recursive: true });
      writeFileSync(file, `# ${name}\n\n<!-- aliases: ${name} -->\n\n## 등장한 사건\n\n<!-- generated:events -->\n<!-- /generated -->\n`, "utf8");
    }
  }

  const indexFile = join(wiki, "index.md");
  let index = readFileSync(indexFile, "utf8");
  const updateTable = (heading: string, entries: Map<string, string>): void => {
    const pattern = new RegExp(`(## ${heading}\\n\\n\\| 페이지 \\| 한 줄 \\|\\n\\|---\\|---\\|\\n)([\\s\\S]*?)(?=\\n## |\\n---|$)`);
    const match = pattern.exec(index);
    if (!match) throw new Error(`색인 표 없음: ${heading}`);
    const rows = new Map<string, string>();
    for (const line of match[2]!.split("\n")) {
      const id = /\[\[([^\]|]+)/.exec(line)?.[1];
      if (id) rows.set(id, line);
    }
    for (const [id, line] of entries) rows.set(id, line);
    const sorted = [...rows.entries()].sort(([a], [b]) => heading === "사건" ? b.localeCompare(a) : a.localeCompare(b, "ko"));
    index = index.replace(pattern, () => match[1]! + sorted.map(([, line]) => line).join("\n") + "\n");
  };

  const eventRows = new Map<string, string>();
  for (const record of records) {
    const text = readFileSync(join(wiki, "events", `${record.wikiSlug}.md`), "utf8");
    const summary = /^- \*\*집계\*\*\s*(.+)$/m.exec(text)?.[1];
    if (!summary) throw new Error(`사건 집계 줄 없음: ${record.wikiSlug}`);
    const id = `events/${record.wikiSlug}`;
    eventRows.set(id, `| [[${id}]] | ${record.eventId.slice(0, 10)} · ${summary} |`);
  }
  updateTable("사건", eventRows);
  const personRows = new Map<string, string>();
  for (const record of records) {
    for (const name of record.people) {
      // 기존 인물 소개는 덮어쓰지 않는다.
      const existing = index.split("\n").find((line) => line.startsWith(`| [[people/${name}]] |`));
      if (existing && !existing.includes("<!-- generated:ingest-person -->")) continue;
      personRows.set(`people/${name}`, `| [[people/${name}]] | [[events/${record.wikiSlug}]] 원제에 등장 <!-- generated:ingest-person --> |`);
    }
  }
  updateTable("인물", personRows);
  index = index.replace(/위키 사건 페이지 \d+건/, `위키 사건 페이지 ${markdownFiles(join(wiki, "events")).length}건`)
    .replace(/인물 \d+명/, `인물 ${markdownFiles(join(wiki, "people")).length}명`)
    .replace(/원본 \d+건/, `원본 ${markdownFiles(join(root, "sources")).length}건`);
  writeFileSync(indexFile, index, "utf8");

  const logFile = join(wiki, "log.md");
  let log = readFileSync(logFile, "utf8");
  const start = "<!-- generated:ingest-records -->";
  const end = "<!-- /generated:ingest-records -->";
  const body = [...records].sort((a, b) => b.recordedOn.localeCompare(a.recordedOn) || b.eventId.localeCompare(a.eventId))
    .map((record) => record.log.trim()).join("\n\n");
  const block = `${start}\n${body}\n${end}`;
  if (log.includes(start)) {
    const from = log.indexOf(start), to = log.indexOf(end, from);
    if (to < 0) throw new Error("ingest 이력 종료 표식 없음");
    log = log.slice(0, from) + block + log.slice(to + end.length);
  } else if (records.length > 0) {
    log = log.replace(/^# 변경 이력\n/, `# 변경 이력\n\n${block}\n`);
  }
  writeFileSync(logFile, log, "utf8");
}
