import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ShareBar from "@/components/ShareBar";
import type { EventBundle, Frame, Item } from "@/lib/event-types";
import { getEventBySlug } from "@/lib/events-source";
import { formatDelay, formatLongDate, formatTime } from "@/lib/kst";

// 승인 후 생성된 새 slug도 재배포 대기 없이 요청 시점에 제공한다.
export const dynamic = "force-dynamic";

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
  const videos = Object.values(items).filter(
    (item) => sources[item.sourceId]?.type === "youtube",
  );
  const videoChannels = new Set(videos.map((item) => item.sourceId)).size;
  // 유튜브는 언론 기사와 다른 기준(제목·게시 시각)으로 연결한다. 기사 프레임
  // 끝에 섞으면 영상 묶음이 20여 개 기사 뒤로 밀려 실제로는 없는 것처럼 보인다.
  const pressFrames = event.frames
    .map((frame) => ({
      ...frame,
      itemIds: frame.itemIds.filter(
        (id) => sources[items[id]?.sourceId ?? ""]?.type === "press",
      ),
    }))
    .filter((frame) => frame.itemIds.length > 0);
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
          발표 {formatTime(event.occurredAt)} · 수집 언론 {total}곳
          {videos.length > 0 && ` · 유튜브 ${videoChannels}개 채널 영상 ${videos.length}건`}
          {" · "}
          {formatTime(checkedAt)} 기준
        </p>
        {event.revisedAt && (
          <p className="text-xs text-zinc-500">
            정정 {formatLongDate(event.revisedAt)} {formatTime(event.revisedAt)}
            {event.revision ? ` · 제${event.revision}판` : ""}
          </p>
        )}
        {event.youtubeTitleMatch && videos.length > 0 && (
          <p className="text-xs leading-5 text-zinc-500">
            유튜브 영상은 제목에 {event.youtubeTitleMatch.requiredTerms.map((term) => `‘${term}’`).join(", ")}이 반드시 포함되고, 전체 핵심어 중{" "}
            {event.youtubeTitleMatch.minimumMatches}개 이상이 포함되며, 사건 {event.youtubeTitleMatch.windowBeforeHours}시간 전부터{" "}
            {event.youtubeTitleMatch.windowAfterHours}시간 후까지 게시된 경우에만 자동 연결했습니다. 영상 내용이나 의도를 판정한 결과가 아닙니다.
          </p>
        )}
      </header>

      <ProportionBar
        frames={event.frames}
        coveredCount={coveredCount}
        silentCount={silentIds.length}
        total={total}
        bundle={bundle}
      />

      {videos.length > 0 && (
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <SectionHeading label="연결된 유튜브 영상" count={videos.length} />
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            {videoChannels}개 채널에서 제목과 게시 시각 기준을 충족한 영상입니다. 언론 보도
            여부나 영상 내용·의도를 판정한 결과는 아닙니다.
          </p>
          <div className="mt-4">
            <ItemList items={videos} bundle={bundle} />
          </div>
        </section>
      )}

      <section className="space-y-6">
        <SectionHeading label="언론 보도" count={coveredCount} />
        {pressFrames.map((frame, i) => (
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
        {...(event.coverageQuery ? { query: event.coverageQuery } : {})}
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
  bundle,
}: {
  frames: Frame[];
  coveredCount: number;
  silentCount: number;
  total: number;
  bundle: EventBundle;
}) {
  // 막대와 '미보도' 분모는 네이버 검색으로 확인한 언론사뿐이다. 유튜브 영상을
  // 섞으면 한 채널의 영상 여러 개가 언론사 수를 부풀리고, '미보도' 뜻도 흐려진다.
  const pressFrames = frames
    .map((frame) => ({
      ...frame,
      itemIds: frame.itemIds.filter(
        (id) => bundle.sources[bundle.items[id]?.sourceId ?? ""]?.type === "press",
      ),
    }))
    .filter((frame) => frame.itemIds.length > 0);

  return (
    <section aria-label="보도 분포">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {pressFrames.map((frame, i) => (
          <div
            key={frame.key}
            className={ACCENTS[i % ACCENTS.length].bar}
            style={{ width: `${(frame.itemIds.length / total) * 100}%` }}
          />
        ))}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {pressFrames.map((frame, i) => (
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
        언론 {total}곳 중 {coveredCount}곳 보도, {silentCount}곳 미보도. 유튜브 영상은 별도로 표시한다.
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
  const rows = frame.itemIds
    .map((id) => bundle.items[id])
    .filter((item): item is Item => Boolean(item));
  const press = rows.filter((item) => bundle.sources[item.sourceId]?.type === "press");
  const videos = rows.filter((item) => bundle.sources[item.sourceId]?.type === "youtube");

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
        {videos.length > 0 && (
          <p className="mt-1 text-xs text-zinc-500">
            이 프레임: 언론 기사 {press.length} · 유튜브 영상 {videos.length}
          </p>
        )}
      </div>
      {press.length > 0 && <ItemList label={videos.length > 0 ? "언론 기사" : undefined} items={press} bundle={bundle} />}
      {videos.length > 0 && <ItemList label="유튜브 영상" items={videos} bundle={bundle} />}
    </section>
  );
}

function ItemList({
  label,
  items,
  bundle,
}: {
  label?: string;
  items: Item[];
  bundle: EventBundle;
}) {
  return (
    <div className={label ? "mt-4 first:mt-0" : undefined}>
      {label && <h4 className="mb-2 text-xs font-semibold text-zinc-500">{label}</h4>}
      <ul className="space-y-3">
        {items.map((item) => <ItemRow key={item.id} item={item} bundle={bundle} />)}
      </ul>
    </div>
  );
}

function ItemRow({ item, bundle }: { item: Item; bundle: EventBundle }) {
  const source = bundle.sources[item.sourceId];
  const delay = source?.type === "youtube"
    ? Math.round((Date.parse(item.publishedAt) - Date.parse(bundle.event.occurredAt)) / 60_000)
    : bundle.event.coverage[item.sourceId]?.delayMinutes;
  const wasChanged = (item.titleHistory?.length ?? 0) > 1;

  return (
    <li>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {source?.name ?? item.sourceId}
        </span>
        {source?.type === "youtube" && (
          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            유튜브 영상
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
  query,
}: {
  sourceIds: string[];
  sources: EventBundle["sources"];
  checkedAt: string;
  /** 이 판정에 쓴 검색어. 판정이 여기 달려 있으므로 감추지 않는다. */
  query?: string;
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
      {query && (
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          검색어 <code className="rounded bg-zinc-200/70 px-1 py-0.5 dark:bg-zinc-800">{query}</code>{" "}
          — 이 판정은 검색어에 달려 있습니다. 다른 표현으로 쓴 기사는 걸리지 않습니다.{" "}
          <Link href="/method" className="underline underline-offset-2">
            자세히
          </Link>
        </p>
      )}
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
