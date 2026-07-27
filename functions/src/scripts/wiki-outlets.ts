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
  /** 프레임 라벨은 사건마다 다르다. 매체 간 비교는 key 로 한다. */
  frameKey?: string;
  frameLabel?: string;
  title?: string;
  url?: string;
  publishedAt?: Date;
}

interface CoFrame {
  sourceId: string;
  name: string;
  /** 같은 사건에서 같은 프레임에 묶인 횟수 */
  same: number;
  /** 둘 다 보도했고 둘 다 프레임이 배정된 사건 수 */
  both: number;
}

/**
 * 2건. 한 번 겹친 것은 우연과 구별되지 않는다.
 *
 * 이 값을 1로 낮추면 사건이 하나뿐일 때도 같은 프레임의 모든 매체가 서로를
 * 가리키게 된다. 그건 정보가 아니라 그 사건의 프레임 표를 옆으로 뉜 것이다.
 */
const MIN_SHARED = 2;

/** 페이지마다 다 싣지 않는다. 꼬리는 대개 1~2회 차이의 잡음이다. */
const MAX_LISTED = 10;

/**
 * 이 매체와 다른 매체가 같은 프레임에 묶인 횟수.
 *
 * 프레임 key 비교는 **같은 사건 안에서만** 뜻이 있다. 사건이 다르면 같은 key 라도
 * 다른 뜻이므로, 사건 슬러그로 짝을 맞춘 뒤에 비교한다.
 */
function coFrames(
  sourceId: string,
  bySource: Map<string, Appearance[]>,
  names: Map<string, string>,
): CoFrame[] {
  const mine = new Map(
    (bySource.get(sourceId) ?? [])
      .filter((a) => a.frameKey)
      .map((a) => [a.eventSlug, a.frameKey!] as const),
  );

  const out: CoFrame[] = [];
  for (const [otherId, apps] of bySource) {
    if (otherId === sourceId) continue;

    let same = 0;
    let both = 0;
    for (const a of apps) {
      const key = mine.get(a.eventSlug);
      if (!key || !a.frameKey) continue;
      both++;
      if (a.frameKey === key) same++;
    }

    if (same >= MIN_SHARED) {
      out.push({ sourceId: otherId, name: names.get(otherId) ?? otherId, same, both });
    }
  }

  return out.sort(
    (x, y) => y.same - x.same || y.both - x.both || x.name.localeCompare(y.name, "ko"),
  );
}

function render(
  source: SourceDoc,
  appearances: Appearance[],
  co: CoFrame[],
): string {
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

  // 프레임이 배정된 사건만 견줄 수 있다. 분모를 밝히려고 따로 센다.
  const comparable = appearances.filter((a) => a.frameKey).length;

  lines.push("", "## 같은 프레임을 공유한 매체", "");

  if (comparable < MIN_SHARED) {
    lines.push(
      `프레임을 견줄 수 있는 사건이 ${comparable}건뿐이다. ${MIN_SHARED}건 이상 쌓인 뒤에 센다.`,
      "",
    );
  } else if (co.length === 0) {
    lines.push(
      `프레임을 견줄 수 있는 사건 ${comparable}건 중, 같은 프레임에 ${MIN_SHARED}번 이상 함께 묶인 매체는 없다.`,
      "",
    );
  } else {
    lines.push(
      `프레임을 견줄 수 있는 사건 ${comparable}건 기준이다. 같은 사건에서 같은 제목 축에 묶인 횟수를 셌다.`,
      "",
      "| 매체 | 같은 프레임 | 함께 관찰 |",
      "| --- | ---: | ---: |",
      ...co
        .slice(0, MAX_LISTED)
        .map((c) => `| [[outlets/${c.sourceId}|${c.name}]] | ${c.same}건 | ${c.both}건 |`),
    );
    if (co.length > MAX_LISTED) {
      lines.push("", `이 밖에 ${co.length - MAX_LISTED}곳이 더 있다.`);
    }
    lines.push(
      "",
      "제목이 같은 축을 골랐다는 사실만 뜻한다. 두 매체 사이에 어떤 관계가 있다는 근거가 아니다 — 같은 사건을 같은 방식으로 요약할 이유는 여럿이다.",
      "",
      "전체 그림은 [[프레임-군집]] 참조.",
      "",
    );
  }

  return lines.join("\n");
}

/**
 * 군집으로 이을 만한 쌍인가 — **함께 관찰된 모든 사건에서 같은 프레임**이었는가.
 *
 * 처음에는 `same >= MIN_SHARED` 로 이었는데, 사건이 3건이 되자 2/3 짜리 쌍이
 * 사방으로 이어져 18곳이 한 덩어리가 됐다. 연결 요소는 한 다리만 걸쳐도 합쳐지므로
 * 느슨한 기준을 쓰면 사건이 늘수록 반드시 뭉개진다.
 *
 * 완전 일치만 잇는다. 분모(함께 관찰한 사건 수)는 표에 그대로 싣는다 —
 * 2/2 와 3/3 은 같은 '완전 일치' 라도 근거의 무게가 다르다.
 */
const isPerfect = (c: CoFrame): boolean => c.same === c.both && c.both >= MIN_SHARED;

function cluster(allCo: Map<string, CoFrame[]>): string[][] {
  const edges = new Map(
    [...allCo].map(([id, list]) => [id, list.filter(isPerfect)] as const),
  );

  const seen = new Set<string>();
  const out: string[][] = [];

  for (const id of edges.keys()) {
    if (seen.has(id) || (edges.get(id) ?? []).length === 0) continue;

    const group: string[] = [];
    const queue = [id];
    seen.add(id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      group.push(cur);
      for (const c of edges.get(cur) ?? []) {
        if (seen.has(c.sourceId)) continue;
        seen.add(c.sourceId);
        queue.push(c.sourceId);
      }
    }
    if (group.length >= 2) out.push(group);
  }

  // 큰 것부터, 같으면 근거가 두꺼운 것부터.
  return out.sort((a, b) => b.length - a.length);
}

const CLUSTER_PAGE = "프레임-군집.md";

function renderClusters(
  clusters: string[][],
  allCo: Map<string, CoFrame[]>,
  names: Map<string, string>,
  eventCount: number,
): string {
  const lines: string[] = [
    "# 같은 프레임에 반복해 묶인 매체",
    "",
    "<!-- 이 페이지는 wiki:outlets 스크립트가 생성한다. 직접 고치지 않는다. -->",
    "",
    `관찰 사건 ${eventCount}건 기준. **함께 관찰된 사건 전부에서** 같은 제목 축을 고른 ` +
      `매체만 이어 붙인 것이다 (최소 ${MIN_SHARED}건 이상 함께 관찰된 경우).`,
    "",
    "**이것은 관계도가 아니다.** 두 매체가 서로를 알거나 조율했다는 근거가 전혀 아니다. " +
      "같은 사건을 같은 방식으로 요약할 이유는 여럿이고, 가장 흔한 이유는 " +
      "같은 보도자료와 같은 현장을 봤다는 것이다. 여기 적힌 것은 **제목이 겹친 횟수**뿐이다.",
    "",
    "한 번이라도 어긋난 쌍은 여기 없다. 매체별 페이지에는 부분 일치까지 다 적혀 있다.",
    "",
  ];

  if (clusters.length === 0) {
    lines.push(
      `아직 함께 관찰된 사건 전부에서 일치한 매체가 없다. 사건이 더 쌓여야 한다.`,
      "",
    );
    return lines.join("\n");
  }

  for (const [i, group] of clusters.entries()) {
    const label = group.map((id) => names.get(id) ?? id).join(" · ");
    lines.push(`## ${i + 1}. ${label} (${group.length}곳)`, "");

    // 쌍을 한 번씩만 싣는다 — 대칭이라 양쪽 다 실으면 두 배로 보인다.
    const rows: string[] = [];
    for (const id of group) {
      for (const c of (allCo.get(id) ?? []).filter(isPerfect)) {
        if (id >= c.sourceId) continue;
        rows.push(
          `| [[outlets/${id}|${names.get(id) ?? id}]] | ` +
            `[[outlets/${c.sourceId}|${c.name}]] | ${c.same}건 | ${c.both}건 |`,
        );
      }
    }
    lines.push("| 매체 | 매체 | 같은 프레임 | 함께 관찰 |", "| --- | --- | ---: | ---: |", ...rows, "");
  }

  lines.push(
    "군집은 '무리' 를 뜻하지 않는다. A-B 와 B-C 가 겹치면 A-C 가 한 번도 겹치지 않아도 " +
      "한 군집으로 묶인다. 위 표의 쌍별 횟수를 봐야 한다.",
    "",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const [sources, eventsSnap, itemsSnap] = await Promise.all([
    loadSources(),
    // 발행분만 본다. 초안은 아직 사람이 검토하지 않은 판정이라 위키에 나가면 안 된다 —
    // 사이트(src/lib/events-source.ts)도 같은 조건으로 읽는다.
    db.collection(EVENTS).where("status", "==", "published").get(),
    db.collection(ITEMS).get(),
  ]);

  const events = eventsSnap.docs.map((d) => d.data() as EventDoc);
  const items = new Map(itemsSnap.docs.map((d) => [d.id, d.data() as ItemDoc] as const));

  const names = new Map(sources.map((s) => [s.id, s.name] as const));

  // 1차 — 매체별 등장 기록. 프레임 일치는 전체가 모여야 셀 수 있으므로 먼저 다 모은다.
  const bySource = new Map<string, Appearance[]>();
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
        ...(frame ? { frameKey: frame.key, frameLabel: frame.label } : {}),
        ...(item
          ? { title: item.title, url: item.url, publishedAt: item.publishedAt.toDate() }
          : {}),
      });
    }

    appearances.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    bySource.set(source.id, appearances);
  }

  // 2차 — 프레임 일치를 세어 파일로 쓴다.
  mkdirSync(OUT_DIR, { recursive: true });

  const allCo = new Map<string, CoFrame[]>();
  for (const source of sources) {
    const co = coFrames(source.id, bySource, names);
    allCo.set(source.id, co);
    writeFileSync(
      join(OUT_DIR, `${source.id}.md`),
      render(source, bySource.get(source.id)!, co),
      "utf8",
    );
  }

  const eventCount = new Set(events.map((e) => e.wikiSlug ?? e.slug)).size;
  const clusters = cluster(allCo);
  writeFileSync(
    join(REPO_ROOT, "wiki", CLUSTER_PAGE),
    renderClusters(clusters, allCo, names, eventCount),
    "utf8",
  );

  const withCo = [...allCo.values()].filter((c) => c.length > 0).length;
  console.log(
    `매체 페이지 ${sources.length}건 생성 · wiki/outlets/\n` +
      `프레임 일치 ${MIN_SHARED}회 이상인 매체를 가진 곳 ${withCo}곳 · 군집 ${clusters.length}개\n` +
      `군집 요약 · wiki/${CLUSTER_PAGE}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
