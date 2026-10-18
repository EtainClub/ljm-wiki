import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { generateCatalog, type IngestRecord } from "./catalog";
import { replaceEventSection } from "./people-block";

test("서로 다른 승인 PR을 어느 순서로 병합해도 충돌 없이 같은 색인·이력을 만든다", () => {
  const results: string[][] = [];
  for (const order of [["a", "b"], ["b", "a"]]) {
    const root = mkdtempSync(join(tmpdir(), "curation-merge-"));
    try {
      const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      for (const dir of ["wiki/events", "wiki/people", "sources", ".automation/ready-events", ".automation/ingest-records"]) mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, "wiki/index.md"), "# 색인\n\n관찰 매체 25곳 · 위키 사건 페이지 0건 · 인물 1명 · 원본 0건\n\n## 인물\n\n| 페이지 | 한 줄 |\n|---|---|\n| [[people/기존인물]] | 직접 작성한 소개 |\n\n## 사건\n\n| 페이지 | 한 줄 |\n|---|---|\n\n## 매체\n\n기존 설명\n");
      writeFileSync(join(root, "wiki/log.md"), "# 변경 이력\n\n## 과거 이력\n\n삭제하면 안 되는 과거 기록\n");
      writeFileSync(join(root, "wiki/people/기존인물.md"), "# 기존인물\n\n직접 작성한 기사 관찰\n");
      git("init", "-b", "main"); git("config", "user.name", "test"); git("config", "user.email", "test@example.invalid");
      git("add", "."); git("commit", "-m", "base");
      for (const [key, suffix] of [["a", "aaaaaa"], ["b", "bbbbbb"]]) {
        git("switch", "-c", key!, "main");
        for (const dir of ["wiki/events", "sources", ".automation/ready-events", ".automation/ingest-records"]) mkdirSync(join(root, dir), { recursive: true });
        const id = `2026-10-18-${suffix}`, slug = `2026-10-18-${key}`;
        const record: IngestRecord = { version: 1, eventId: id, wikiSlug: slug, title: key!, recordedOn: "2026-10-18", people: ["새인물"], log: `## [2026-10-18] ingest | ${key}\n\n- [[events/${slug}]]\n` };
        writeFileSync(join(root, `.automation/ingest-records/${id}.json`), JSON.stringify(record));
        writeFileSync(join(root, `.automation/ready-events/${id}.json`), JSON.stringify({ version: 1, eventId: id }));
        writeFileSync(join(root, `wiki/events/${slug}.md`), `# ${key}\n\n- **집계** 언론 2곳 보도 / 미발견 23곳 · 등록 유튜브 0건\n\n[[people/새인물]]\n`);
        writeFileSync(join(root, `sources/${key}.md`), `# ${key}\n`);
        git("add", "."); git("commit", "-m", key!);
      }
      git("switch", "main");
      for (const branch of order) {
        git("merge", "--no-edit", branch);
        // 실제 발행 봇처럼 첫 PR 뒤 공통 파일을 커밋해도 다음 PR이 충돌하지 않는다.
        generateCatalog(root);
        git("add", "."); git("commit", "-m", "publish catalog");
      }
      const files = ["wiki/index.md", "wiki/log.md", "wiki/people/새인물.md"];
      const before = files.map((file) => readFileSync(join(root, file), "utf8"));
      generateCatalog(root);
      assert.deepEqual(files.map((file) => readFileSync(join(root, file), "utf8")), before, "재실행은 멱등이어야 한다");
      assert.match(before[0]!, /위키 사건 페이지 2건 · 인물 2명 · 원본 2건/);
      assert.match(before[0]!, /직접 작성한 소개/);
      assert.match(before[1]!, /삭제하면 안 되는 과거 기록/);
      assert.match(readFileSync(join(root, "wiki/people/기존인물.md"), "utf8"), /직접 작성한 기사 관찰/);
      results.push(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  assert.deepEqual(results[0], results[1], "병합 순서가 산출물을 바꾸면 안 된다");
});

test("경로를 벗어난 record는 파일 생성 전에 거부한다", () => {
  const root = mkdtempSync(join(tmpdir(), "curation-invalid-"));
  try {
    mkdirSync(join(root, ".automation/ingest-records"), { recursive: true });
    writeFileSync(join(root, ".automation/ingest-records/2026-10-18-aaaaaa.json"), JSON.stringify({ version: 1, eventId: "2026-10-18-aaaaaa", wikiSlug: "../bad", title: "bad", recordedOn: "2026-10-18", people: [], log: "" }));
    assert.throws(() => generateCatalog(root), /잘못된 ingest record/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("수동 인물 페이지 전환은 관찰 본문·주석을 보존하고 목록은 중복하지 않는다", () => {
  const old = "# 인물\n\n소개\n\n## 등장한 사건\n\n- [[events/old]] — 수동 집계\n\n수동 설명과 [출처](https://example.com)\n<!-- 보존할 주석 -->\n\n## 제목 관찰\n\n다른 절\n";
  const body = "- [[events/new]] — 최신 집계";
  const next = replaceEventSection(old, body);
  assert.match(next, /소개/);
  assert.match(next, /수동 설명과 \[출처\]/);
  assert.match(next, /보존할 주석/);
  assert.match(next, /## 제목 관찰\n\n다른 절/);
  assert.doesNotMatch(next, /events\/old/);
  assert.equal(replaceEventSection(next, body), next);
});
