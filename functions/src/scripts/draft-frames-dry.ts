/**
 * 프레임 분류 드라이런.
 *
 *   npm --prefix functions run frames:dry
 *
 * API 키가 없으면 모델에 보낼 프롬프트를 그대로 출력만 한다. 프롬프트는 이
 * 제품에서 가장 논쟁적인 산출물이라, 호출 없이도 문구를 검토할 수 있어야 한다.
 *
 * ANTHROPIC_API_KEY 가 있으면 실제로 호출해 결과와 경고까지 보여준다.
 *
 * ⚠ 여기서 만드는 '사건' 은 실제 사건이 아니다. 최근 수집된 제목을 임의로
 *   묶어 프롬프트 모양을 확인하는 용도다. 분류 품질 평가에는 쓸 수 없다.
 */

import { collectFromSource } from "../collect/run";
import { itemIdFor } from "../collect/item-id";
import { PRESS_SOURCES } from "../sources.seed";
import { SYSTEM_PROMPT, buildUserPrompt, type FrameCandidate } from "../frames/prompt";
import { draftFrames, FrameDraftError } from "../frames/draft";

const SAMPLE_SIZE = 20;

const kstTime = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

async function main(): Promise<void> {
  const sources = PRESS_SOURCES.filter((s) => s.strategy === "rss").slice(0, 6);
  const results = await Promise.all(sources.map((s) => collectFromSource(s)));

  const byId = new Map(sources.map((s) => [s.id, s.name] as const));
  const candidates: FrameCandidate[] = [];

  // 매체마다 한 건씩 돌아가며 뽑아 한 매체가 목록을 채우지 않게 한다.
  for (let round = 0; candidates.length < SAMPLE_SIZE && round < 10; round++) {
    for (const result of results) {
      const item = result.items[round];
      if (!item || candidates.length >= SAMPLE_SIZE) continue;
      candidates.push({
        itemId: itemIdFor(item.url).slice(0, 8),
        sourceName: byId.get(item.sourceId) ?? item.sourceId,
        title: item.title,
        publishedAt: kstTime(item.publishedAt),
      });
    }
  }

  if (candidates.length === 0) {
    console.error("수집된 제목이 없습니다. collect:dry 로 피드 상태를 먼저 확인하세요.");
    process.exit(1);
  }

  const input = {
    eventTitle: "(드라이런) 최근 수집된 제목 묶음",
    eventSummary:
      "실제 사건이 아니라 프롬프트 형태 확인용으로 최근 제목을 임의로 모은 것입니다.",
    occurredAt: kstTime(new Date()),
    candidates,
  };

  console.log("=".repeat(72));
  console.log("SYSTEM");
  console.log("=".repeat(72));
  console.log(SYSTEM_PROMPT);
  console.log();
  console.log("=".repeat(72));
  console.log("USER");
  console.log("=".repeat(72));
  console.log(buildUserPrompt(input));
  console.log();

  if (!process.env["ANTHROPIC_API_KEY"]) {
    console.log("=".repeat(72));
    console.log("ANTHROPIC_API_KEY 가 없어 호출은 건너뜁니다. 위 프롬프트만 검토하세요.");
    console.log("=".repeat(72));
    return;
  }

  console.log("=".repeat(72));
  console.log("모델 응답");
  console.log("=".repeat(72));
  try {
    const draft = await draftFrames(input);
    for (const frame of draft.frames) {
      console.log(`\n■ ${frame.label}  (${frame.itemIds.length})`);
      console.log(`  ${frame.note}`);
      for (const id of frame.itemIds) {
        const c = candidates.find((x) => x.itemId === id);
        if (c) console.log(`  - ${c.sourceName}: ${c.title}`);
      }
    }
    if (draft.unassignedItemIds.length > 0) {
      console.log(`\n■ 미배정 (${draft.unassignedItemIds.length})`);
      for (const id of draft.unassignedItemIds) {
        const c = candidates.find((x) => x.itemId === id);
        if (c) console.log(`  - ${c.sourceName}: ${c.title}`);
      }
    }
    if (draft.warnings.length > 0) {
      console.log(`\n⚠ 검수 경고 ${draft.warnings.length}건`);
      for (const w of draft.warnings) console.log(`  - ${w}`);
    }
  } catch (e) {
    if (e instanceof FrameDraftError) console.error(`실패: ${e.message}`);
    else throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
