import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedEvents } from "@/lib/events-source";
import { formatLongDate } from "@/lib/kst";

export const metadata: Metadata = {
  title: "지난 사건",
  description: "지금까지 기록한 사건 전체 목록.",
};

export default async function ArchivePage() {
  const events = await getPublishedEvents();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">지난 사건</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          지금까지 기록한 사건 {events.length}건입니다.
        </p>
      </header>

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
