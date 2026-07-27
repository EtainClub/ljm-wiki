import Link from "next/link";
import { getPublishedEvents } from "@/lib/events-source";
import { formatLongDate } from "@/lib/kst";
import { getWikiPagesByKind } from "@/lib/wiki";

/** 홈은 최근 7건까지만 보여준다. 전체는 /archive. */
const HOME_LIMIT = 7;

/**
 * 첫 화면.
 *
 * 이전에는 "오늘의 사건" 으로 시작해 사건 목록만 있었다. 그 화면에는 '이재명'
 * 이라는 말이 한 번도 나오지 않아서, 처음 온 사람은 무엇에 대한 사이트인지
 * 알 수 없었다. 주제를 맨 위에 두고, 쌓인 양(사건·인물·매체)을 숫자로 보인 뒤
 * 사건 목록으로 내려간다.
 */
export default async function Home() {
  const all = await getPublishedEvents();
  const events = all.slice(0, HOME_LIMIT);
  const people = getWikiPagesByKind("people");
  const outlets = getWikiPagesByKind("outlets");

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">
          이재명 대통령 관련 보도를
          <br />
          언론사별로 기록합니다
        </h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          같은 사건에 어느 매체가 <strong className="font-semibold text-zinc-800 dark:text-zinc-200">어떤 제목</strong>을
          달았는지, 그리고 <strong className="font-semibold text-zinc-800 dark:text-zinc-200">어디가 다루지 않았는지</strong>{" "}
          그대로 모읍니다. 인물의 성향이나 의도를 서술하지 않습니다 — 판단은
          보시는 분이 합니다.
        </p>

        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
          <div className="flex items-baseline gap-1.5">
            <dt>기록한 사건</dt>
            <dd className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
              {all.length}건
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>인물</dt>
            <dd className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
              {people.length}명
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>관찰 매체</dt>
            <dd className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
              {outlets.length}곳
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/w"
            className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            인물·매체 위키 보기
          </Link>
          <Link
            href="/method"
            className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium transition hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
          >
            어떻게 기록하나
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-baseline gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          <span className="text-base font-semibold">최근 사건</span>
          <span className="text-sm tabular-nums text-zinc-500">{all.length}</span>
        </h2>

        <ul className="space-y-3">
          {events.map(({ event }) => {
            const entries = Object.values(event.coverage);
            const silent = entries.filter((c) => c.status === "none").length;
            return (
              <li key={event.slug}>
                <Link
                  href={`/e/${event.slug}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <p className="text-xs text-zinc-500">
                    {formatLongDate(event.occurredAt)}
                  </p>
                  <h3 className="mt-1.5 text-lg font-semibold leading-snug">
                    {event.title}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-500">
                    수집 {entries.length}곳 · 보도 {entries.length - silent}곳 ·{" "}
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      미보도 {silent}곳
                    </span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        {all.length > HOME_LIMIT && (
          <p className="pt-1 text-sm">
            <Link href="/archive" className="underline underline-offset-4">
              지난 사건 전체 보기
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
