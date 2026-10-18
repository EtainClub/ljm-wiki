import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedEvents } from "@/lib/events-source";
import { formatLongDate } from "@/lib/kst";
import { TOPICS, getTopic, topicsOf } from "@/lib/topics";

export const metadata: Metadata = {
  title: "지난 사건",
  description: "지금까지 기록한 사건 전체 목록. 쟁점별로 골라 볼 수 있습니다.",
};

// 새 발행 사건을 App Hosting 인스턴스와 CDN 캐시에 고정하지 않는다.
export const dynamic = "force-dynamic";

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition ${
    active
      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
      : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
  }`;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [all, params] = await Promise.all([getPublishedEvents(), searchParams]);
  const topic = getTopic(typeof params.topic === "string" ? params.topic : "");
  const tagged = all.map((bundle) => ({ ...bundle, topics: topicsOf(bundle.event.title) }));
  const events = topic ? tagged.filter((b) => b.topics.some((t) => t.key === topic.key)) : tagged;
  const counts = new Map(
    TOPICS.map((t) => [t.key, tagged.filter((b) => b.topics.some((x) => x.key === t.key)).length]),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">지난 사건</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          {topic
            ? `‘${topic.label}’ 쟁점 사건 ${events.length}건입니다.`
            : `지금까지 기록한 사건 ${all.length}건입니다.`}
        </p>
      </header>

      <nav aria-label="쟁점" className="space-y-2">
        <ul className="flex flex-wrap gap-1.5">
          <li>
            <Link href="/archive" className={chipClass(!topic)}>
              전체
            </Link>
          </li>
          {TOPICS.filter((t) => (counts.get(t.key) ?? 0) > 0).map((t) => (
            <li key={t.key}>
              <Link
                href={`/archive?topic=${t.key}`}
                aria-current={topic?.key === t.key ? "page" : undefined}
                className={chipClass(topic?.key === t.key)}
              >
                {t.label} <span className="tabular-nums opacity-70">{counts.get(t.key)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">
          쟁점은 사건 제목의 핵심어로 정합니다.{" "}
          <Link href="/guide#topics" className="underline underline-offset-4">
            분류 규칙
          </Link>
          {topic?.im && (
            <>
              {" · "}
              <a
                href={`https://im.jamtong.kr/topics/${topic.im}`}
                className="underline underline-offset-4"
              >
                임통에서 이 쟁점의 발언 보기
              </a>
            </>
          )}
        </p>
      </nav>

      <ul className="space-y-3">
        {events.map(({ event, topics }) => {
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
                  {topics.length > 0 && ` · ${topics.map((t) => t.label).join(" · ")}`}
                </p>
                <h2 className="mt-1.5 text-lg font-semibold leading-snug">
                  {event.title}
                </h2>
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
    </div>
  );
}
