import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { runCollection } from "./collect/run";

/**
 * 수집 스케줄.
 *
 * 하루 4회. 사건 발생 직후·점심·저녁·마감 시간대를 덮는다.
 * 제목 변경은 별도 잡이 아니라 이 수집 과정에서 자연히 감지된다 —
 * 같은 URL 을 다시 만났을 때 제목이 다르면 이력에 덧붙는다.
 *
 * 유튜브는 아직 대상 채널이 없어 시크릿을 걸지 않았다. defineSecret 으로
 * 선언하면 그 시크릿이 실제로 존재해야 배포가 되므로, 채널을 추가할 때
 * YOUTUBE_API_KEY 시크릿을 만들고 secrets 배열과 runCollection 인자를
 * 함께 되살린다.
 */

export const collectSources = onSchedule(
  {
    schedule: "0 7,12,18,22 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB",
    retryCount: 1,
  },
  async () => {
    const summary = await runCollection();

    logger.info("수집 완료", summary);

    // 피드는 예고 없이 죽는다. 연속 실패는 조용히 넘기지 않는다.
    if (summary.failures.length > 0) {
      logger.warn("수집 실패한 매체", { failures: summary.failures });
    }

    // 200 을 주면서 몇 달 전 항목만 돌려주는 피드가 실재한다.
    // 실패로 잡히지 않으므로 따로 경고한다.
    if (summary.stale.length > 0) {
      logger.warn("신선한 항목이 없는 매체(정체된 피드일 수 있음)", {
        stale: summary.stale,
      });
    }
  },
);
