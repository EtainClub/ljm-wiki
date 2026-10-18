import type { Metadata } from "next";
import Link from "next/link";
import ToneBar from "@/components/ToneBar";
import type { Item, Source, ToneEntry } from "@/lib/event-types";
import { getPublishedEvents } from "@/lib/events-source";
import { formatLongDate } from "@/lib/kst";
import { TONES, surfaceCues, toneDef } from "@/lib/tone";

export const metadata: Metadata = {
  title: "보도 태도 분석",
  description:
    "기사·영상마다 지지·호평, 사실 전달, 정책 비판, 의혹 제기, 비난·조롱으로 나눈 결과와 매체·채널별 건수, 겉과 속 주의 목록.",
};

export const dynamic = "force-dynamic";

/** 이보다 적게 분류된 매체·채널은 비율을 내지 않는다. 몇 건으로 낸 비율은 성향처럼 읽힌다. */
const MIN_FOR_RATIO = 5;
const FLAGGED_LIMIT = 30;

interface Row {
  item: Item;
  source: Source | undefined;
  tone: ToneEntry;
  cues: string[];
  event: { slug: string; title: string; occurredAt: string };
}

/**
 * 잼통 Voice 의 분석 화면과 같은 자리다. 다만 단위가 답글이 아니라 보도다.
 * 매체·채널별 표는 건수와 비율만 싣는다 — 순위를 매기지 않고 이름순으로 둔다.
 */
export default async function AnalysisPage() {
  const bundles = await getPublishedEvents();

  const rows: Row[] = [];
  let framedTotal = 0;
  for (const { event, sources, items } of bundles) {
    const framed = [...new Set(event.frames.flatMap((f) => f.itemIds))].filter((id) => items[id]);
    framedTotal += framed.length;
    const context = `${event.title} ${event.summary}`;
    for (const id of framed) {
      const tone = event.tones?.[id];
      if (!tone) continue;
      const item = items[id]!;
      rows.push({
        item,
        source: sources[item.sourceId],
        tone,
        cues: surfaceCues(item.title, tone.tone, context),
        event: { slug: event.slug, title: event.title, occurredAt: event.occurredAt },
      });
    }
  }
  const classifiedEvents = new Set(rows.map((r) => r.event.slug)).size;
  const press = rows.filter((r) => r.source?.type === "press");
  const videos = rows.filter((r) => r.source?.type === "youtube");
  const flagged = rows
    .filter((r) => r.cues.length > 0)
    .sort((a, b) => Date.parse(b.item.publishedAt) - Date.parse(a.item.publishedAt));

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">보도 태도 분석</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          제목만으로는 비판인지 비난인지 가리기 어렵습니다. 기사·영상마다 제목과 리드를 읽고
          태도를 나눈 결과입니다. AI가 나누고 운영자가 승인한 뒤 공개하며, 기사마다 근거 한
          줄이 사건 페이지에 있습니다.
        </p>
        {rows.length > 0 && (
          <p className="text-sm text-zinc-500">
            사건 {classifiedEvents}건 · 분류 {rows.length}건 / 전체 {framedTotal}건
          </p>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm leading-6 dark:border-zinc-700">
          아직 분류된 기사가 없습니다. 새 사건부터 분류가 함께 승인되고, 지난 사건은 승인 PR을
          거쳐 차례로 채워집니다.
        </p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="border-b border-zinc-200 pb-2 text-base font-semibold dark:border-zinc-800">
              전체 분포
            </h2>
            {press.length > 0 && <ToneBar label="언론 기사" tones={press.map((r) => r.tone.tone)} />}
            {videos.length > 0 && <ToneBar label="유튜브 영상" tones={videos.map((r) => r.tone.tone)} />}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-baseline gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <span className="text-base font-semibold">겉과 속 주의</span>
              <span className="text-sm tabular-nums text-zinc-500">{flagged.length}</span>
            </h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              지지·호평이나 사실 전달로 분류됐지만, 사건 제목·요약에 없는 부정 연상어(탄핵,
              지지율 하락, 위기 등)를 제목에 함께 실은 기사·영상입니다. 의도를 판정한 것이
              아니라 덧붙은 말을 보여줍니다.
            </p>
            {flagged.length === 0 ? (
              <p className="text-sm text-zinc-500">해당하는 기사·영상이 없습니다.</p>
            ) : (
              <ul className="space-y-4">
                {flagged.slice(0, FLAGGED_LIMIT).map((r) => (
                  <li key={r.item.id} className="space-y-1 text-sm leading-6">
                    <p className="text-xs text-zinc-500">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {r.source?.name ?? r.item.sourceId}
                      </span>{" "}
                      · {toneDef(r.tone.tone).label} · 덧붙은 말 ‘{r.cues.join("’, ‘")}’
                    </p>
                    <a href={r.item.url} target="_blank" rel="noopener noreferrer" className="block text-[15px] underline-offset-4 hover:underline">
                      {r.item.title}
                    </a>
                    <Link href={`/e/${r.event.slug}`} className="text-xs text-zinc-500 underline underline-offset-4">
                      {formatLongDate(r.event.occurredAt)} · {r.event.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <OutletTable title="언론사별" rows={press} />
          <OutletTable title="유튜브 채널별" rows={videos} />
        </>
      )}

      <section className="space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        <h2 className="border-b border-zinc-200 pb-2 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
          분류 기준
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          {TONES.map((def) => (
            <div key={def.key} className="contents">
              <dt className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                <span className={`size-2 rounded-full ${def.bar}`} />
                {def.label}
              </dt>
              <dd>{def.description}</dd>
            </div>
          ))}
        </dl>
        <p>
          매체·채널에 성향 라벨이나 점수를 붙이지 않습니다. 같은 매체도 사건마다 태도가
          다릅니다.{" "}
          <Link href="/method#tone" className="underline underline-offset-4">자세한 기준과 한계</Link>
        </p>
      </section>
    </div>
  );
}

function OutletTable({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  const byOutlet = new Map<string, { name: string; tones: ToneEntry["tone"][] }>();
  for (const r of rows) {
    const entry = byOutlet.get(r.item.sourceId) ?? { name: r.source?.name ?? r.item.sourceId, tones: [] };
    entry.tones.push(r.tone.tone);
    byOutlet.set(r.item.sourceId, entry);
  }
  // 순위가 아니다. 이름순으로 둔다.
  const outlets = [...byOutlet.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm tabular-nums text-zinc-500">{outlets.length}</span>
      </h2>
      <p className="text-xs leading-5 text-zinc-500">
        이름순입니다. 분류 {MIN_FOR_RATIO}건 미만은 비율을 내지 않습니다.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-3 font-medium">이름</th>
              <th className="py-2 pr-3 font-medium">분류</th>
              {TONES.map((def) => (
                <th key={def.key} className="whitespace-nowrap py-2 pr-3 font-medium">
                  {def.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outlets.map(({ name, tones }) => (
              <tr key={name} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-2 pr-3">{name}</td>
                <td className="py-2 pr-3">{tones.length}</td>
                {TONES.map((def) => {
                  const n = tones.filter((t) => t === def.key).length;
                  return (
                    <td key={def.key} className="whitespace-nowrap py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                      {n === 0 ? "·" : tones.length >= MIN_FOR_RATIO ? `${n} (${Math.round((n / tones.length) * 100)}%)` : n}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
