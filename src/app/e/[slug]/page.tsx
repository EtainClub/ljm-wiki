import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShareBar from "@/components/ShareBar";
import type { EventBundle, Frame, Item } from "@/lib/event-types";
import { getEventBySlug, getPublishedEvents } from "@/lib/events-source";
import { formatDelay, formatLongDate, formatTime } from "@/lib/kst";

// 정적 export: 모든 경로를 빌드 시 확정해야 한다.
export const dynamicParams = false;

export async function generateStaticParams() {
  const events = await getPublishedEvents();
  return events.map((b) => ({ slug: b.event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getEventBySlug(slug);
  if (!bundle) return {};
  const { event } = bundle;
  const silent = Object.values(event.coverage).filter(
    (c) => c.status === "none",
  ).length;
  const description = `${event.summary} 보도하지 않은 곳 ${silent}곳.`;
  // 크롤러는 OG 이미지를 오래 캐시한다. 내용이 바뀌면 URL 이 바뀌도록 버전을 붙인다.
  const ogUrl = `/e/${slug}/og.png?v=${event.publishedAt}`;

  return {
    title: event.title,
    description,
    openGraph: {
      type: "article",
      title: event.title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: "사건별 보도 제목 비교" }],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [ogUrl],
    },
  };
}

/**
 * 프레임 강조색. 좋음/나쁨 함의를 피하려고 빨강·초록을 쓰지 않고,
 * 채도가 비슷한 세 색을 순서대로 배정한다. 색은 구분용일 뿐 평가가 아니다.
 */
const ACCENTS = [
  {
    bar: "bg-indigo-500",
    dot: "bg-indigo-500",
    rule: "border-indigo-200 dark:border-indigo-900",
  },
  {
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    rule: "border-amber-200 dark:border-amber-900",
  },
  {
    bar: "bg-teal-500",
    dot: "bg-teal-500",
    rule: "border-teal-200 dark:border-teal-900",
  },
] as const;

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundle = await getEventBySlug(slug);
  if (!bundle) notFound();

  const { event, sources, items } = bundle;
  const entries = Object.entries(event.coverage);
  const total = entries.length;
  const silentIds = entries
    .filter(([, c]) => c.status === "none")
    .map(([sourceId]) => sourceId);
  const coveredCount = total - silentIds.length;
  const changed = Object.values(items).filter(
    (it) => (it.titleHistory?.length ?? 0) > 1,
  );
  const checkedAt = entries[0]?.[1].checkedAt ?? event.publishedAt;

  return (
    <article className="space-y-8">
      {event.isSample && (
        <p className="rounded-lg border border-dashed border-zinc-400 px-4 py-3 text-xs leading-5 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
          <strong className="font-semibold">샘플 데이터입니다.</strong>{" "}포맷 확인용으로,
          매체명과 제목은 모두 가상입니다. 실재 매체의 보도가 아닙니다.
        </p>
      )}

      <header className="space-y-3">
        <p className="text-xs text-zinc-500">{formatLongDate(event.occurredAt)}</p>
        <h1 className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
          {event.title}
        </h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          {event.summary}
        </p>
        <p className="text-xs text-zinc-500">
          발표 {formatTime(event.occurredAt)} · 수집 매체 {total}곳 ·{" "}
          {formatTime(checkedAt)} 기준
        </p>
      </header>

      <ProportionBar
        frames={event.frames}
        coveredCount={coveredCount}
        silentCount={silentIds.length}
        total={total}
      />

      <section className="space-y-6">
        <SectionHeading label="보도한 곳" count={coveredCount} />
        {event.frames.map((frame, i) => (
          <FrameBlock
            key={frame.key}
            frame={frame}
            accent={ACCENTS[i % ACCENTS.length]}
            bundle={bundle}
          />
        ))}
      </section>

      <SilentBlock
        sourceIds={silentIds}
        sources={sources}
        checkedAt={checkedAt}
      />

      {changed.length > 0 && (
        <TitleChangeBlock items={changed} bundle={bundle} />
      )}

      <ShareBar
        title={event.title}
        cardHref={`/e/${event.slug}/card.png`}
        cardName={`${event.slug}.png`}
      />
    </article>
  );
}

/* ────────────────────────────────────────────────────────── */

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="flex items-baseline gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm tabular-nums text-zinc-500">{count}</span>
    </h2>
  );
}

function ProportionBar({
  frames,
  coveredCount,
  silentCount,
  total,
}: {
  frames: Frame[];
  coveredCount: number;
  silentCount: number;
  total: number;
}) {
  return (
    <section aria-label="보도 분포">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {frames.map((frame, i) => (
          <div
            key={frame.key}
            className={ACCENTS[i % ACCENTS.length].bar}
            style={{ width: `${(frame.itemIds.length / total) * 100}%` }}
          />
        ))}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {frames.map((frame, i) => (
          <div key={frame.key} className="flex items-center gap-1.5">
            <span
              className={`size-2 shrink-0 rounded-full ${ACCENTS[i % ACCENTS.length].dot}`}
            />
            <dt className="text-zinc-600 dark:text-zinc-400">{frame.label}</dt>
            <dd className="font-semibold tabular-nums">{frame.itemIds.length}</dd>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <dt className="text-zinc-600 dark:text-zinc-400">보도하지 않음</dt>
          <dd className="font-semibold tabular-nums">{silentCount}</dd>
        </div>
      </dl>
      <p className="sr-only">
        전체 {total}곳 중 {coveredCount}곳 보도, {silentCount}곳 미보도.
      </p>
    </section>
  );
}

function FrameBlock({
  frame,
  accent,
  bundle,
}: {
  frame: Frame;
  accent: (typeof ACCENTS)[number];
  bundle: EventBundle;
}) {
  return (
    <section className={`border-l-2 pl-4 ${accent.rule}`}>
      <div className="mb-3">
        <h3 className="flex items-baseline gap-2 text-[15px] font-semibold">
          {frame.label}
          <span className="tabular-nums text-zinc-500">
            {frame.itemIds.length}
          </span>
        </h3>
        {frame.note && (
          <p className="mt-1 text-xs leading-5 text-zinc-500">{frame.note}</p>
        )}
      </div>
      <ul className="space-y-3">
        {frame.itemIds.map((id) => (
          <ItemRow key={id} item={bundle.items[id]} bundle={bundle} />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({ item, bundle }: { item: Item; bundle: EventBundle }) {
  const source = bundle.sources[item.sourceId];
  const delay = bundle.event.coverage[item.sourceId]?.delayMinutes;
  const wasChanged = (item.titleHistory?.length ?? 0) > 1;

  return (
    <li>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {source.name}
        </span>
        {source.type === "youtube" && (
          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            영상
          </span>
        )}
        <span className="tabular-nums">{formatTime(item.publishedAt)}</span>
        {typeof delay === "number" && (
          <span className="tabular-nums text-zinc-400">
            {formatDelay(delay)}
          </span>
        )}
        {wasChanged && (
          <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            제목 수정됨
          </span>
        )}
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[15px] leading-6 underline-offset-4 hover:underline"
      >
        {item.title}
      </a>
    </li>
  );
}

function SilentBlock({
  sourceIds,
  sources,
  checkedAt,
}: {
  sourceIds: string[];
  sources: EventBundle["sources"];
  checkedAt: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
      <h2 className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">보도하지 않음</span>
        <span className="text-2xl font-bold tabular-nums">
          {sourceIds.length}
        </span>
      </h2>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {sourceIds.map((id) => (
          <li
            key={id}
            className="rounded-md bg-zinc-200/70 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {sources[id].name}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-5 text-zinc-500">
        {formatLongDate(checkedAt)} {formatTime(checkedAt)} 기준입니다. 이후
        보도되면 이 목록에서 빠지고 보도 지연 시간으로 바뀝니다.
      </p>
    </section>
  );
}

function TitleChangeBlock({
  items,
  bundle,
}: {
  items: Item[];
  bundle: EventBundle;
}) {
  return (
    <section>
      <SectionHeading label="제목을 수정함" count={items.length} />
      <ul className="mt-4 space-y-4">
        {items.map((item) => {
          const history = item.titleHistory!;
          const first = history[0];
          const last = history[history.length - 1];
          return (
            <li key={item.id} className="text-sm">
              <p className="mb-1.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {bundle.sources[item.sourceId].name}
                </span>
                <span className="tabular-nums">
                  {formatTime(first.observedAt)} → {formatTime(last.observedAt)}
                </span>
              </p>
              <p className="leading-6 text-zinc-500 line-through decoration-zinc-400">
                {first.title}
              </p>
              <p className="mt-1 leading-6">{last.title}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
