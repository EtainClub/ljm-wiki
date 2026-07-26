/**
 * 수집을 한 번 실행해 Firestore 에 적재한다.
 *
 *   GOOGLE_CLOUD_PROJECT=new-ljm npm --prefix functions run collect:once
 *
 * 스케줄러가 붙기 전, 또는 붙은 뒤에도 손으로 한 번 돌려보고 싶을 때 쓴다.
 * collect:dry 와 달리 실제로 쓰기가 일어난다.
 */

import { runCollection } from "../collect/run";

async function main(): Promise<void> {
  const started = Date.now();
  const summary = await runCollection(process.env["YOUTUBE_API_KEY"]);

  console.log(
    `\n매체 ${summary.sources}곳 · 성공 ${summary.ok} · 실패 ${summary.failed}\n` +
      `신규 ${summary.added}건 · 제목 변경 ${summary.changed}건 · ${Date.now() - started}ms`,
  );

  if (summary.failures.length > 0) {
    console.log(`\n실패한 매체:`);
    for (const f of summary.failures) console.log(`  ${f.sourceId}: ${f.error}`);
  }

  if (summary.stale.length > 0) {
    console.log(
      `\n신선한 항목 0건 (정체된 피드일 수 있음): ${summary.stale.join(", ")}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
