/**
 * 매체 페이지를 생성한다.
 *
 *   npm --prefix functions run wiki:outlets
 *
 * 왜 스크립트인가 — ingest 를 한 번 해 보고 알았다. 매체 페이지에는 판단이
 * 들어가지 않는다. 전부 집계다: 몇 건 중 몇 건 보도했나, 평균 지연이 얼마인가,
 * 사건마다 어느 프레임이었나. LLM 이 이걸 손으로 쓰면 산수를 틀리고,
 * 매체가 늘수록 drift 만 커진다.
 *
 * 그래서 역할을 나눈다.
 *   - 인물·사건 페이지 : 판단이 필요하다 → LLM(에이전트)이 쓴다
 *   - 매체 페이지      : 집계뿐이다     → 이 스크립트가 쓴다
 *
 * 생성 파일은 편집하지 않는다. 다시 돌리면 덮어쓴다.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVENTS, ITEMS, db } from "../firebase";
import type { EventDoc, ItemDoc, SourceDoc } from "../domain";
import { loadSources } from "../curate/events";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const OUT_DIR = join(REPO_ROOT, "wiki", "outlets");

const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

interface Appearance {
  eventSlug: string;
  eventTitle: string;
  eventDate: string;
  covered: boolean;
  delayMinutes?: number;
  frameLabel?: string;
  title?: string;
  url?: string;
  publishedAt?: Date;
}

function render(source: SourceDoc, appearances: Appearance[]): string {
  const covered = appearances.filter((a) => a.covered);
  const delays = covered
    .map((a) => a.delayMinutes)
    .filter((d): d is number => typeof d === "number");
  const avg =
    delays.length > 0
      ? Math.round(delays.reduce((s, d) => s + d, 0) / delays.length)
      : null;

  const lines: string[] = [
    `# ${source.name}`,
    "",
    "<!-- 이 페이지는 wiki:outlets 스크립트가 생성한다. 직접 고치지 않는다. -->",
    "",
    "## 관찰 기록",
    "",
    `- 관찰 사건 ${appearances.length}건 중 ${covered.length}건 보도 · 미보도 ${appearances.length - covered.length}건`,
  ];

  if (avg !== null) {
    lines.push(
      `- 평균 보도 지연 +${avg}분 (${Math.floor(avg / 60)}시간 ${avg % 60}분)`,
    );
  }
  lines.push(
    `- 수집 방식 ${source.type === "youtube" ? "유튜브" : source.strategy === "rss" ? "RSS" : "네이버 검색"}`,
    "",
    "## 사건별 프레임",
    "",
  );

  if (appearances.length === 0) {
    lines.push("아직 관찰된 사건이 없다.", "");
  }

  for (const a of appearances) {
    if (!a.covered) {
      lines.push(`- [[events/${a.eventSlug}]] — **보도하지 않음** (${a.eventDate})`);
      continue;
    }
    lines.push(
      `- [[events/${a.eventSlug}]] — ${a.frameLabel ?? "*프레임 미배정*"} (${a.eventDate})`,
    );
    if (a.title && a.url) {
      lines.push(
        `  ${a.publishedAt ? hhmm(a.publishedAt) : ""} ` +
          `${typeof a.delayMinutes === "number" ? `(+${a.delayMinutes}분)` : ""} ` +
          `[「${a.title}」](${a.url})`,
      );
    }
  }

  lines.push(
    "",
    "## 같은 프레임을 공유한 매체",
    "",
    appearances.filter((a) => a.covered).length >= 2
      ? "<!-- 계산 대상. 사건이 더 쌓이면 채운다. -->"
      : "관찰 사건이 1건뿐이라 패턴을 말할 수 없다. 2건 이상 쌓인 뒤에 채운다.",
    "",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const [sources, eventsSnap, itemsSnap] = await Promise.all([
    loadSources(),
    db.collection(EVENTS).get(),
    db.collection(ITEMS).get(),
  ]);

  const events = eventsSnap.docs.map((d) => d.data() as EventDoc);
  const items = new Map(itemsSnap.docs.map((d) => [d.id, d.data() as ItemDoc] as const));

  mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  for (const source of sources) {
    const appearances: Appearance[] = [];

    for (const event of events) {
      const entry = event.coverage[source.id];
      if (!entry) continue; // 이 사건의 관찰 대상이 아니었다

      if (entry.status !== "covered" || !entry.itemId) {
        appearances.push({
          eventSlug: event.wikiSlug ?? event.slug,
          eventTitle: event.title,
          eventDate: event.date,
          covered: false,
        });
        continue;
      }

      const item = items.get(entry.itemId);
      const frame = event.frames.find((f) => f.itemIds.includes(entry.itemId!));

      appearances.push({
        eventSlug: event.wikiSlug ?? event.slug,
        eventTitle: event.title,
        eventDate: event.date,
        covered: true,
        ...(typeof entry.delayMinutes === "number"
          ? { delayMinutes: entry.delayMinutes }
          : {}),
        ...(frame ? { frameLabel: frame.label } : {}),
        ...(item
          ? { title: item.title, url: item.url, publishedAt: item.publishedAt.toDate() }
          : {}),
      });
    }

    appearances.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    writeFileSync(join(OUT_DIR, `${source.id}.md`), render(source, appearances), "utf8");
    written++;
  }

  console.log(`매체 페이지 ${written}건 생성 · wiki/outlets/`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
