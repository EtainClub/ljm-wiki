import type { Metadata } from "next";
import Link from "next/link";
import { getWikiPage, getWikiPagesByKind, type WikiPage } from "@/lib/wiki";

export const metadata: Metadata = {
  title: "위키",
  description:
    "이재명 대통령을 둘러싼 인물들이 언론에 어떻게 등장했는가의 기록. 인물에 대한 서술이 아니라 보도의 기록입니다.",
};

export default function WikiIndex() {
  const people = getWikiPagesByKind("people");
  const events = getWikiPagesByKind("events");
  const outlets = getWikiPagesByKind("outlets");
  const hasSchema = Boolean(getWikiPage(["schema"]));

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">위키</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          이재명 대통령을 둘러싼 인물들이 언론에 어떻게 등장했는가의 기록입니다.
          기록 대상은 <strong className="font-semibold">인물이 아니라 보도</strong>입니다 — 인물의
          성향이나 의도를 서술하지 않고, 어느 매체가 언제 어떤 제목을 달았는지만 적습니다.
        </p>
        {hasSchema && (
          <p className="text-sm">
            <Link href="/w/schema" className="underline underline-offset-4">
              기록 규칙 보기
            </Link>
          </p>
        )}
      </header>

      <Section title="인물" pages={people} />
      <Section title="사건" pages={events} />
      <Section title="매체" pages={outlets} compact />
    </div>
  );
}

function Section({
  title,
  pages,
  compact = false,
}: {
  title: string;
  pages: WikiPage[];
  compact?: boolean;
}) {
  if (pages.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm tabular-nums text-zinc-500">{pages.length}</span>
      </h2>

      {compact ? (
        <ul className="flex flex-wrap gap-1.5">
          {pages.map((p) => (
            <li key={p.id}>
              <Link
                href={`/w/${p.slug.map(encodeURIComponent).join("/")}`}
                className="block rounded-md bg-zinc-200/70 px-2.5 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => (
            <li key={p.id}>
              <Link
                href={`/w/${p.slug.map(encodeURIComponent).join("/")}`}
                className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 text-[15px] font-medium transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
