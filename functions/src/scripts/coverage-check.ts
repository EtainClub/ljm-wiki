/**
 * '보도하지 않음' 판정을 실제로 돌려본다.
 *
 *   npm --prefix functions run coverage -- "청년 주거 대책"
 *   npm --prefix functions run coverage -- "청년 주거 대책" 24     # 최근 24시간
 *
 * 자격증명은 functions/.env.local 에서 읽는다:
 *   NAVER_CLIENT_ID=...
 *   NAVER_CLIENT_SECRET=...
 *
 * 이 판정은 사이트에 사실로 표기되므로, 붙이기 전에 눈으로 확인해야 한다.
 * 특히 '보도하지 않음' 이 맞는지 — 질의어가 좁지 않으면 실제로 보도한 매체가
 * 검색 상한 밖으로 밀려 잘못 찍힐 수 있다.
 */

import { loadLocalEnv, requireEnv } from "../env";
import { checkCoverage, type CoverageTarget } from "../collect/naver";
import { PRESS_SOURCES } from "../sources.seed";

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

async function main(): Promise<void> {
  const query = process.argv[2];
  if (!query) {
    console.error('사용법: npm --prefix functions run coverage -- "질의어" [시간]');
    process.exit(1);
  }

  const hours = Number(process.argv[3] ?? "48");
  const since = new Date(Date.now() - hours * 3_600_000);

  const creds = {
    clientId: requireEnv("NAVER_CLIENT_ID"),
    clientSecret: requireEnv("NAVER_CLIENT_SECRET"),
  };

  const targets: CoverageTarget[] = PRESS_SOURCES.filter((s) => s.domain).map((s) => ({
    sourceId: s.id,
    domain: s.domain!,
  }));
  const names = new Map(PRESS_SOURCES.map((s) => [s.id, s.name] as const));

  console.log(`질의어: "${query}"  ·  최근 ${hours}시간  ·  대상 ${targets.length}곳\n`);

  const outcome = await checkCoverage(targets, query, creds, since);

  const covered = [...outcome.covered.entries()].sort(
    (a, b) => (a[1][0]?.publishedAt.getTime() ?? 0) - (b[1][0]?.publishedAt.getTime() ?? 0),
  );

  console.log(`■ 보도함 ${covered.length}곳`);
  for (const [sourceId, items] of covered) {
    const first = items[0]!;
    console.log(`  ${kst(first.publishedAt)}  ${names.get(sourceId) ?? sourceId}`);
    console.log(`      ${first.title}`);
    if (items.length > 1) console.log(`      (외 ${items.length - 1}건)`);
  }

  const silent = targets.filter((t) => !outcome.covered.has(t.sourceId));
  console.log(`\n■ 보도하지 않음 ${silent.length}곳`);
  console.log(`  ${silent.map((t) => names.get(t.sourceId) ?? t.sourceId).join(", ")}`);

  console.log(
    `\n조회 ${outcome.scanned}건 · 목록 밖 매체 ${outcome.unmatched}건 · 검색 ${outcome.calls}회 사용`,
  );

  // 시간창을 다 훑지 못했으면 '보도하지 않음' 을 사실로 쓸 수 없다.
  if (outcome.truncated) {
    console.log(
      `\n⚠ 시간창을 다 훑지 못했습니다(호출 상한 도달).\n` +
        `  실제로 보도한 매체가 잘려 나갔을 수 있으므로 위 '보도하지 않음' 은\n` +
        `  사실로 쓸 수 없습니다. 질의어를 좁히거나 시간창을 줄이세요.`,
    );
  } else {
    console.log(`\n✓ 시간창 전체를 훑었습니다. '보도하지 않음' 판정을 쓸 수 있습니다.`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
