/**
 * 드라이런: 네트워크만 쓰고 Firestore 는 건드리지 않는다.
 *
 * Firebase 프로젝트 없이도 "지금 이 순간 어느 피드가 살아 있고 몇 건이
 * 들어오는가" 를 확인할 수 있다. 피드가 죽는 것을 조기에 잡는 용도다.
 *
 *   npm --prefix functions run collect:dry
 */

import { collectFromSource } from "../collect/run";
import { normalizeUrl } from "../collect/item-id";
import { PRESS_SOURCES } from "../sources.seed";

async function main(): Promise<void> {
  const started = Date.now();
  const rssSources = PRESS_SOURCES.filter((s) => s.strategy === "rss");
  const naverSources = PRESS_SOURCES.filter((s) => s.strategy !== "rss");

  console.log(`RSS 대상 ${rssSources.length}곳 · 네이버 전략 ${naverSources.length}곳\n`);

  const results = [];
  for (let i = 0; i < rssSources.length; i += 6) {
    const chunk = rssSources.slice(i, i + 6);
    results.push(...(await Promise.all(chunk.map((s) => collectFromSource(s)))));
  }

  let total = 0;
  for (const [idx, result] of results.entries()) {
    const source = rssSources[idx]!;
    if (result.ok) {
      total += result.items.length;
      const sample = result.items[0];
      console.log(
        `OK  ${source.id.padEnd(12)} ${String(result.items.length).padStart(4)}건  ` +
          `${sample ? sample.title.slice(0, 44) : ""}`,
      );
      if (sample) console.log(`    ${normalizeUrl(sample.url).slice(0, 100)}`);
    } else {
      console.log(`--  ${source.id.padEnd(12)} 실패: ${result.error}`);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n성공 ${ok}/${results.length} · 항목 ${total}건 · ${Date.now() - started}ms`);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\n실패한 매체 (네이버 전략으로 돌리거나 주소를 고쳐야 함):`);
    for (const f of failed) console.log(`  ${f.sourceId}: ${f.error}`);
  }

  console.log(
    `\n네이버 전략(발굴 대상 아님, 사건별 보도 확인만): ${naverSources.map((s) => s.id).join(", ")}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
