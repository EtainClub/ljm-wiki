/**
 * ready 사건을 GitHub PR 승인 대기열에 올리는 불변 표식 파일을 만든다.
 *
 *   npm --prefix functions run queue:approval -- <event-slug>
 *
 * 이 명령은 Firestore 상태를 바꾸지 않는다. 생성된 파일을 PR로 올리고 사람이
 * 병합하면 publish-ready workflow가 검증·발행·정적 배포를 처리한다.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "../env";
import { getEvent } from "../curate/events";

loadLocalEnv();

const REPO_ROOT = join(__dirname, "..", "..", "..");
const QUEUE_DIR = join(REPO_ROOT, ".automation", "ready-events");

async function main(): Promise<void> {
  const slug = process.argv[2]?.trim();
  if (!slug) throw new Error("사용법: queue:approval -- <event-slug>");

  const event = await getEvent(slug);
  if (event.status !== "ready") {
    throw new Error(`ready 상태인 사건만 승인 대기열에 넣을 수 있습니다: ${slug}`);
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
  console.log("이 파일과 사건 원본·위키 변경을 PR에 올리세요. 병합이 곧 발행 승인입니다.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
