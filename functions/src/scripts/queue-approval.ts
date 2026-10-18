/**
 * ready 사건을 GitHub PR 승인 대기열에 올리는 불변 표식 파일을 만든다.
 *
 *   npm --prefix functions run queue:approval -- <event-slug>
 *   npm --prefix functions run queue:approval -- correction <event-slug>
 *
 * 이 명령은 Firestore 상태를 바꾸지 않는다. 생성된 파일을 PR로 올리고 사람이
 * 병합하면 publish-ready workflow가 검증·발행·정적 배포를 처리한다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "../env";
import { getEvent, getReadyYouTubeCorrection } from "../curate/events";
import { RECORD_DIR, type IngestRecord } from "../wiki/catalog";

loadLocalEnv();

const REPO_ROOT = join(__dirname, "..", "..", "..");
const QUEUE_DIR = join(REPO_ROOT, ".automation", "ready-events");

async function main(): Promise<void> {
  const correction = process.argv[2] === "correction";
  const slug = process.argv[correction ? 3 : 2]?.trim();
  if (!slug) {
    throw new Error("사용법: queue:approval -- <event-slug> | correction <event-slug>");
  }

  if (correction) {
    const plan = await getReadyYouTubeCorrection(slug);
    if (plan.itemIds.length === 0) {
      throw new Error(`연결할 유튜브 영상이 없는 정정 계획입니다: ${slug}`);
    }

    mkdirSync(QUEUE_DIR, { recursive: true });
    const path = join(QUEUE_DIR, `${slug}.youtube-correction.json`);
    writeFileSync(
      path,
      JSON.stringify(
        {
          version: 2,
          action: "youtube-correction",
          eventId: slug,
          queuedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    console.log(`유튜브 정정 승인 표식 생성: ${path}`);
    console.log("이 파일만 PR에 올리세요. 병합 시 같은 사건 URL에 정정이 적용됩니다.");
    return;
  }

  const event = await getEvent(slug);
  if (event.status !== "ready") {
    throw new Error(`ready 상태인 사건만 승인 대기열에 넣을 수 있습니다: ${slug}`);
  }

  if (!event.wikiSlug || !/^(?!\.{1,2}$)[^/\\\r\n]+$/.test(event.wikiSlug)) throw new Error("유효한 wikiSlug가 필요합니다.");
  const wikiPath = join(REPO_ROOT, "wiki", "events", `${event.wikiSlug}.md`);
  const wiki = readFileSync(wikiPath, "utf8");
  const recordPath = join(REPO_ROOT, RECORD_DIR, `${slug}.json`);
  const people = [...new Set([...wiki.matchAll(/\[\[people\/([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1]!.trim()))].sort();
  if (people.some((name) => !/^(?!\.{1,2}$)[^/\\\r\n]+$/.test(name))) throw new Error("잘못된 인물 페이지 이름입니다.");
  const recordedOn = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const record: IngestRecord = {
    version: 1, eventId: slug, wikiSlug: event.wikiSlug, title: event.title, recordedOn, people,
    log: `## [${recordedOn}] ingest | ${event.title}\n\n- [[events/${event.wikiSlug}]] · 원제·질의어·프레임·관측 한계는 [사건 기록](events/${event.wikiSlug}.md)에 있다.\n`,
  };
  // 재실행해도 사람이 보완한 사건별 이력은 보존한다.
  if (existsSync(recordPath)) {
    const existing = JSON.parse(readFileSync(recordPath, "utf8")) as IngestRecord;
    if (existing.eventId !== slug || existing.wikiSlug !== event.wikiSlug || JSON.stringify(existing.people) !== JSON.stringify(people)) {
      throw new Error(`기존 ingest record와 사건의 wikiSlug·인물이 다릅니다. 먼저 확인하세요: ${recordPath}`);
    }
  } else {
    mkdirSync(join(REPO_ROOT, RECORD_DIR), { recursive: true });
    writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n", "utf8");
  }

  mkdirSync(QUEUE_DIR, { recursive: true });
  const path = join(QUEUE_DIR, `${slug}.json`);
  writeFileSync(
    path,
    JSON.stringify(
      {
        version: 1,
        eventId: slug,
        queuedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`승인 대기 표식 생성: ${path}`);
  console.log("marker·ingest-record·사건 원본·사건 위키만 PR에 올리세요. 공통 색인·이력·인물 파일은 병합 후 생성합니다.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
