/**
 * Firestore 에 실제로 무엇이 들어 있는지 본다.
 *
 *   GOOGLE_CLOUD_PROJECT=new-ljm npm --prefix functions run inspect
 *
 * 피드는 예고 없이 죽는다. sources/{id}.health 의 연속 실패를 여기서 확인한다.
 */

import { ITEMS, SOURCES, db } from "../firebase";
import type { ItemDoc, SourceDoc } from "../domain";

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
  const [sourcesSnap, itemsSnap] = await Promise.all([
    db.collection(SOURCES).get(),
    db.collection(ITEMS).get(),
  ]);

  const sources = sourcesSnap.docs.map((d) => d.data() as SourceDoc);
  const items = itemsSnap.docs.map((d) => d.data() as ItemDoc);

  console.log(`매체 ${sources.length}곳 · 항목 ${items.length}건\n`);

  // 매체별 수집량. 0건인 rss 매체가 조용히 죽은 피드다.
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.sourceId, (counts.get(item.sourceId) ?? 0) + 1);
  }

  const rows = sources
    .map((s) => ({
      id: s.id,
      name: s.name,
      strategy: s.type === "youtube" ? "youtube" : (s.strategy ?? "-"),
      count: counts.get(s.id) ?? 0,
      failures: s.health?.consecutiveFailures ?? 0,
      empty: s.health?.consecutiveEmpty ?? 0,
      lastError: s.health?.lastError ?? null,
    }))
    .sort((a, b) => b.count - a.count);

  for (const r of rows) {
    // 실패가 아니라 '성공했는데 신선한 항목이 0건' 인 상태를 구분해서 보여준다.
    const stale = r.empty > 0 ? ` ← 신선한 항목 0건 ${r.empty}회 연속` : "";
    const err = r.failures > 0 ? `  실패 ${r.failures}회: ${r.lastError}` : "";
    console.log(
      `${String(r.count).padStart(4)}  ${r.id.padEnd(13)} ${r.strategy.padEnd(8)} ${r.name}${stale}${err}`,
    );
  }

  // 제목이 바뀐 항목 — 이 제품의 부가 킬러 기능
  const changed = items.filter((i) => i.status === "title_changed");
  console.log(`\n제목 변경 ${changed.length}건`);
  for (const item of changed.slice(0, 5)) {
    const h = item.titleHistory;
    console.log(`  ${item.sourceId}`);
    console.log(`    「${h[0]?.title}」`);
    console.log(`    → 「${h[h.length - 1]?.title}」`);
  }

  const newest = items
    .map((i) => i.publishedAt.toDate())
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const oldest = items
    .map((i) => i.publishedAt.toDate())
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (newest && oldest) {
    console.log(`\n게시 시각 범위: ${kst(oldest)} ~ ${kst(newest)}`);
  }

  // 아직 사건에 배정되지 않은 항목 = 큐레이션 후보 풀
  const unassigned = items.filter((i) => i.eventId === null).length;
  console.log(`미배정(큐레이션 후보): ${unassigned}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
