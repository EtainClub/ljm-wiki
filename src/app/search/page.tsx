import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedEvents } from "@/lib/events-source";
import { formatLongDate } from "@/lib/kst";
import { getWikiPagesByKind, type WikiPage } from "@/lib/wiki";

export const metadata: Metadata = {
  title: "검색",
  description: "사건, 기사·영상 제목, 인물, 매체를 찾습니다.",
};

export const dynamic = "force-dynamic";

const MAX_QUERY = 100;
const MAX_TITLES = 3;

/** 제목은 CJK 호환 한자(李 U+F9E1)로 오기도 한다. 비교할 때만 맞춘다. */
const norm = (s: string) => s.normalize("NFC").toLocaleLowerCase("ko");

/**
 * 사건 제목·요약과 그 사건에 모인 기사·영상 원제, 위키 인물·매체 이름을 찾는다.
 * 원제까지 찾는 것이 핵심이다 — '탄핵' 처럼 사건 이름에는 없고 매체가 덧붙인
 * 말이 어느 제목에 실렸는지가 이 사이트에서 찾을 만한 것이다.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [bundles, params] = await Promise.all([getPublishedEvents(), searchParams]);
  const query = (typeof params.q === "string" ? params.q : "").trim().slice(0, MAX_QUERY);
  const q = norm(query);

  const events = q
    ? bundles
        .map(({ event, sources, items }) => {
          const titles = Object.values(items)
            .filter((item) => norm(item.title).includes(q))
            .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
          const own = norm(event.title).includes(q) || norm(event.summary).includes(q);
          return { event, sources, titles, own };
        })
        .filter((r) => r.own || r.titles.length > 0)
    : [];
  const titleHits = events.reduce((sum, r) => sum + r.titles.length, 0);
  const pages = (kind: WikiPage["kind"]) =>
    q ? getWikiPagesByKind(kind).filter((p) => norm(p.title).includes(q)) : [];
  const people = pages("people");
  const outlets = pages("outlets");
  const wikiHref = (p: WikiPage) => `/w/${p.slug.map(encodeURIComponent).join("/")}`;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">검색</h1>
        <form action="/search" className="flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            검색어
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={MAX_QUERY}
            placeholder="사건, 기사 제목의 표현, 인물, 매체"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            찾기
          </button>
        </form>
        {!q && (
          <p className="text-sm leading-6 text-zinc-500">
            기사·영상 원제까지 찾습니다. 예를 들어{" "}
            <Link href="/search?q=탄핵" className="underline underline-offset-4">탄핵</Link>,{" "}
            <Link href="/search?q=지지율" className="underline underline-offset-4">지지율</Link>을 찾으면
            그 말을 제목에 실은 매체와 사건이 나옵니다.
          </p>
        )}
      </header>

      {q && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          &lsquo;{query}&rsquo; — 사건 {events.length}건 · 제목 {titleHits}건 · 인물 {people.length} ·
          매체 {outlets.length}
        </p>
      )}

      {(people.length > 0 || outlets.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">인물·매체</h2>
          <ul className="flex flex-wrap gap-1.5">
            {[...people, ...outlets].map((p) => (
              <li key={p.id}>
                <Link
                  href={wikiHref(p)}
                  className="inline-block rounded-md border border-zinc-200 px-2 py-1 text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <ul className="space-y-3">
          {events.map(({ event, sources, titles }) => (
            <li
              key={event.slug}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-xs text-zinc-500">{formatLongDate(event.occurredAt)}</p>
              <h2 className="mt-1.5 text-lg font-semibold leading-snug">
                <Link href={`/e/${event.slug}`} className="underline-offset-4 hover:underline">
                  {event.title}
                </Link>
              </h2>
              {titles.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {titles.slice(0, MAX_TITLES).map((item) => (
                    <li key={item.id} className="text-sm leading-6">
                      <span className="mr-2 text-xs font-medium text-zinc-500">
                        {sources[item.sourceId]?.name ?? item.sourceId}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:underline"
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                  {titles.length > MAX_TITLES && (
                    <li className="text-xs text-zinc-500">
                      외 {titles.length - MAX_TITLES}건 — 사건 페이지에서 모두 보기
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {q && events.length === 0 && people.length === 0 && outlets.length === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm dark:border-zinc-700">
          찾은 기록이 없습니다. 기록한 사건에 모인 제목만 찾습니다.
        </p>
      )}
    </div>
  );
}
