import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedEvents } from "@/lib/events-source";
import { formatDateTime } from "@/lib/kst";
import { filterVideoRecords, getVideoRecords, titleForms } from "@/lib/youtube-records";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "유튜브 보도 기록",
  description: "이재명 관련 사건을 다룬 등록 유튜브 채널의 제목, 표현, 변경 이력을 비교합니다.",
};

const FORMS = ["질문형 제목", "인용 표현", "라이브·중계 표기", "쇼츠 표기", "일반 제목"];
const PAGE_SIZE = 20;
const fieldClass = "min-w-0 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function YouTubePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [bundles, params] = await Promise.all([getPublishedEvents(), searchParams]);
  const records = getVideoRecords(bundles);
  const filters = {
    channel: first(params.channel),
    event: first(params.event),
    query: first(params.q).slice(0, 200),
    form: first(params.form),
  };
  const channels = new Map<string, { name: string; videos: Set<string>; events: Set<string> }>();
  // 등록 목록을 모두 보인다. 영상 0건은 '미보도' 판정이 아니다.
  for (const bundle of bundles) {
    for (const source of Object.values(bundle.sources)) {
      if (source.type === "youtube" && !channels.has(source.id)) {
        channels.set(source.id, { name: source.name, videos: new Set(), events: new Set() });
      }
    }
  }
  for (const record of records) {
    const channel = channels.get(record.channel.id)!;
    channel.videos.add(record.item.id);
    channel.events.add(record.eventSlug);
  }
  const channelList = [...channels].sort((a, b) => a[1].name.localeCompare(b[1].name, "ko"));
  const events = [...new Map(records.map((r) => [r.eventSlug, r.eventTitle])).entries()];
  const filtered = filterVideoRecords(records, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requestedPage = Number(first(params.page));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (next: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ channel: filters.channel, event: filters.event, q: filters.query, form: filters.form })) {
      if (value) query.set(key, value);
    }
    query.set("page", String(next));
    return "/youtube?" + query.toString();
  };

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">채널별 보도 관찰</p>
        <h1 className="text-3xl font-bold tracking-tight">유튜브는 어떻게 다뤘나</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          이재명 관련 사건을 다룬 등록 채널의 원제와 제목 표현을 모았습니다.
          같은 사건을 고르면 채널마다 앞세운 표현을 비교할 수 있습니다.
        </p>
        <dl className="flex flex-wrap gap-5 rounded-xl bg-indigo-50 p-4 text-sm dark:bg-indigo-950/40">
          <div><dt className="text-zinc-500">등록 채널</dt><dd className="mt-1 text-xl font-semibold">{channels.size}개</dd></div>
          <div><dt className="text-zinc-500">연결 영상</dt><dd className="mt-1 text-xl font-semibold">{new Set(records.map((r) => r.item.id)).size}건</dd></div>
          <div><dt className="text-zinc-500">다룬 사건</dt><dd className="mt-1 text-xl font-semibold">{events.length}건</dd></div>
        </dl>
        {bundles.some((b) => b.event.isSample) && <p className="text-sm text-amber-700 dark:text-amber-300">샘플 데이터입니다. 가상 제목과 채널이며 실제 보도 기록이 아닙니다.</p>}
      </header>

      <form action="/youtube" className="grid gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800">
        <label className="space-y-1.5 text-xs font-medium">채널
          <select name="channel" defaultValue={filters.channel} className={fieldClass}>
            <option value="">모든 등록 채널</option>
            {channelList.map(([id, c]) => <option key={id} value={id}>{c.name}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">같은 사건 비교
          <select name="event" defaultValue={filters.event} className={fieldClass}>
            <option value="">모든 사건</option>
            {events.map(([slug, title]) => <option key={slug} value={slug}>{title}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">제목 표현
          <select name="form" defaultValue={filters.form} className={fieldClass}>
            <option value="">모든 표현</option>
            {FORMS.map((form) => <option key={form}>{form}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">제목·채널·사건 검색
          <input type="search" name="q" maxLength={200} defaultValue={filters.query} placeholder="예: 리트윗, 지뢰, 김어준" className={fieldClass} />
        </label>
        <div className="flex items-center gap-4 sm:col-span-2">
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">기록 찾기</button>
          <Link href="/youtube" className="text-sm underline underline-offset-4">초기화</Link>
        </div>
      </form>

      <section aria-label="영상 기록" className="space-y-4">
        <h2 className="text-base font-semibold">최신 영상 기록 <span className="font-normal text-zinc-500">{filtered.length}건</span></h2>
        {visible.length === 0 && <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm leading-6 dark:border-zinc-700">조건에 맞는 공개 영상 기록이 없습니다. 사건 연결이 확인된 영상만 표시하므로, 채널에서 다루지 않았다는 뜻은 아닙니다.</p>}
        {visible.map((record) => (
          <article key={record.eventSlug + record.item.id} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <Link href={"/youtube?channel=" + encodeURIComponent(record.channel.id)} className="font-semibold underline underline-offset-4">{record.channel.name}</Link>
              <time dateTime={record.item.publishedAt} className="text-zinc-500">{formatDateTime(record.item.publishedAt)} KST</time>
            </div>
            <h3 className="text-base font-semibold leading-7"><a href={record.item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{record.item.title} <span className="text-xs font-normal text-zinc-500">↗</span></a></h3>
            <ul aria-label="제목에서 관찰한 표현" className="flex flex-wrap gap-1.5">
              {titleForms(record.item.title).map((form) => <li key={form} className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{form}</li>)}
            </ul>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400"><span className="font-medium">제목 프레임:</span> {record.frameLabel}</p>
            <Link href={"/e/" + record.eventSlug} className="block text-sm text-indigo-700 underline underline-offset-4 dark:text-indigo-300">{record.eventTitle} — 사건 기록 보기</Link>
            {record.eventSummary && <details className="text-sm leading-6"><summary className="cursor-pointer text-zinc-500">사건 요약 읽기</summary><p className="mt-2 text-zinc-600 dark:text-zinc-400">{record.eventSummary}</p><p className="mt-2 text-xs text-zinc-500">이 요약은 사건의 맥락입니다. 영상 내용 요약은 별도로 작성되지 않았습니다.</p></details>}
            {(record.item.titleHistory?.length ?? 0) > 1 && <details className="text-sm"><summary className="cursor-pointer text-zinc-500">제목 변경 이력</summary><ol className="mt-2 space-y-2">{record.item.titleHistory!.map((h, i) => <li key={i}><time dateTime={h.observedAt} className="text-xs text-zinc-500">{formatDateTime(h.observedAt)}</time><p className="mt-1 leading-6">{h.title}</p></li>)}</ol></details>}
          </article>
        ))}
        {pageCount > 1 && <nav aria-label="영상 목록 페이지" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="underline">이전</Link> : <span />}
          <span>{page} / {pageCount}</span>
          {page < pageCount ? <Link href={pageHref(page + 1)} className="underline">다음</Link> : <span />}
        </nav>}
      </section>

      <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-semibold">등록 채널과 기록 범위</summary>
        <p className="mt-3 text-xs leading-6 text-zinc-500">운영자가 등록한 채널에서 공개 사건에 연결한 영상만 셉니다. 제목 표현은 질문부호·인용부호·라이브·쇼츠 표기를 기준으로 분류하며, 실제 영상 형식이나 채널의 찬반 성향을 판정하지 않습니다. 기록 수는 영향력 순위가 아닙니다.</p>
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">{channelList.map(([id, channel]) => <li key={id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><Link href={"/youtube?channel=" + encodeURIComponent(id)} className="underline underline-offset-4">{channel.name}</Link><span className="text-xs text-zinc-500">{channel.videos.size}개 영상 · {channel.events.size}개 사건</span></li>)}</ul>
        <Link href="/sources" className="mt-3 inline-block text-sm underline underline-offset-4">전체 수집 매체 목록</Link>
      </details>
    </article>
  );
}
