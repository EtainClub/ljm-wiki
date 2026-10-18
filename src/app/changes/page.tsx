import type { Metadata } from "next";
import Link from "next/link";
import type { Item, Source } from "@/lib/event-types";
import { getPublishedEvents } from "@/lib/events-source";
import { formatLongDate, formatTime } from "@/lib/kst";

export const metadata: Metadata = {
  title: "제목 변경 기록",
  description:
    "게시 뒤 제목을 바꾼 기사와 영상. 처음 관측한 제목과 바뀐 제목을 관측 시각과 함께 나란히 둡니다.",
};

// 사건 목록과 같이 요청마다 최신 발행분을 읽는다.
export const dynamic = "force-dynamic";

interface Change {
  item: Item;
  source: Source | undefined;
  event: { slug: string; title: string };
}

/**
 * 제목 변경은 이 사이트에서 가장 다투기 어려운 사실이다 — 두 제목 모두 우리가
 * 관측한 원문이다. 사건 페이지마다 흩어져 있으면 매체가 얼마나 자주 바꾸는지
 * 보이지 않아서 한 장으로 모은다.
 */
export default async function ChangesPage() {
  const bundles = await getPublishedEvents();

  const byId = new Map<string, Change>();
  for (const { event, sources, items } of bundles) {
    for (const item of Object.values(items)) {
      if ((item.titleHistory?.length ?? 0) < 2 || byId.has(item.id)) continue;
      byId.set(item.id, {
        item,
        source: sources[item.sourceId],
        event: { slug: event.slug, title: event.title },
      });
    }
  }
  const lastSeen = (c: Change) => Date.parse(c.item.titleHistory!.at(-1)!.observedAt);
  const changes = [...byId.values()].sort((a, b) => lastSeen(b) - lastSeen(a));

  const perSource = new Map<string, { name: string; count: number }>();
  for (const { item, source } of changes) {
    const entry = perSource.get(item.sourceId) ?? { name: source?.name ?? item.sourceId, count: 0 };
    entry.count += 1;
    perSource.set(item.sourceId, entry);
  }
  const ranked = [...perSource.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">제목 변경 기록</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          게시 뒤 제목이 바뀐 기사와 영상입니다. 처음 관측한 제목과 나중에 관측한 제목을
          시각과 함께 둡니다. 원래 제목을 복원한 것이 아니라{" "}
          <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
            우리가 언제 무엇을 봤는지
          </strong>
          의 기록이며, 바꾼 이유는 판단하지 않습니다.
        </p>
      </header>

      {changes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm dark:border-zinc-700">
          아직 관측된 제목 변경이 없습니다.
        </p>
      ) : (
        <>
          <section aria-label="매체·채널별 변경 수" className="space-y-2">
            <h2 className="flex items-baseline gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <span className="text-base font-semibold">매체·채널별</span>
              <span className="text-sm tabular-nums text-zinc-500">{changes.length}건</span>
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {ranked.map(({ name, count }) => (
                <li
                  key={name}
                  className="rounded-md bg-zinc-200/70 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {name} <span className="font-semibold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          <ul className="space-y-5">
            {changes.map(({ item, source, event }) => {
              const history = item.titleHistory!;
              const first = history[0]!;
              const last = history.at(-1)!;
              return (
                <li key={item.id} className="space-y-1.5 border-b border-zinc-200 pb-5 dark:border-zinc-800">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {source?.name ?? item.sourceId}
                    </span>
                    {source?.type === "youtube" && (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        유튜브 영상
                      </span>
                    )}
                    <span className="tabular-nums">
                      {formatLongDate(first.observedAt)} {formatTime(first.observedAt)} →{" "}
                      {formatLongDate(last.observedAt) !== formatLongDate(first.observedAt) &&
                        `${formatLongDate(last.observedAt)} `}
                      {formatTime(last.observedAt)}
                    </span>
                    {history.length > 2 && <span>{history.length - 1}번 변경</span>}
                  </p>
                  <p className="text-sm leading-6 text-zinc-500 line-through decoration-zinc-400">
                    {first.title}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[15px] leading-6 underline-offset-4 hover:underline"
                  >
                    {last.title}
                  </a>
                  <Link
                    href={`/e/${encodeURIComponent(event.slug)}`}
                    className="inline-block text-xs text-zinc-500 underline underline-offset-4"
                  >
                    {event.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
