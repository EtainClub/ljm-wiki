import type { Metadata } from "next";
import Link from "next/link";
import type { Source } from "@/lib/event-types";
import { getPublishedEvents } from "@/lib/events-source";

export const metadata: Metadata = {
  title: "수집 매체 목록",
  description:
    "관찰 대상 매체와 채널 전체 목록. 목록은 사건마다 바뀌지 않으며, 추가·제외는 이력으로 남깁니다.",
};

/**
 * 목록을 통째로 공개하는 것이 이 사이트가 '전체 언론'이 아니라
 * '이 목록'을 관찰한다는 사실을 분명히 하는 유일한 방법이다.
 */
export default async function SourcesPage() {
  const events = await getPublishedEvents();
  // 매체 목록은 사건마다 같다. 첫 사건의 것을 쓰되, 사건이 없으면 빈 목록.
  const all = Object.values(events[0]?.sources ?? {}).sort((a, b) =>
    a.name.localeCompare(b.name, "ko"),
  );
  const press = all.filter((s) => s.type === "press");
  const youtube = all.filter((s) => s.type === "youtube");
  const isSample = events[0]?.event.isSample === true;

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">수집 매체 목록</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          아래 {all.length}곳을 관찰합니다. 목록은 <strong className="font-semibold">사건마다 바뀌지
          않습니다.</strong>{" "}어떤 사건에서 특정 매체가 보이지 않는다면, 목록에서
          빠진 것이 아니라 그 사건을 다루지 않은 것입니다.
        </p>
        {isSample && (
          <p className="rounded-lg border border-dashed border-zinc-400 px-4 py-3 text-xs leading-5 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
            <strong className="font-semibold">샘플 목록입니다.</strong>{" "}포맷 확인용
            가상 매체이며, 실제 목록은 수집 시작 전에 공개 지표로 확정합니다.
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="border-b border-zinc-200 pb-2 text-base font-semibold dark:border-zinc-800">
          선정 기준
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7">
          <li>편집자의 인상이 아니라 외부에 공개된 지표로 기계적으로 정합니다</li>
          <li>언론은 발행부수·열독률·포털 제휴 여부 등을 봅니다</li>
          <li>유튜브는 구독자 수와 정치·시사 분야 업로드 빈도를 봅니다</li>
          <li>매체별 성향·등급은 기록하지 않습니다</li>
        </ul>
        <p className="text-[15px] leading-7">
          자세한 내용은{" "}
          <Link href="/method" className="underline underline-offset-4">
            방법론과 한계
          </Link>
          를 봐 주세요.
        </p>
      </section>

      <SourceGroup title="언론" sources={press} />
      <SourceGroup title="유튜브 채널" sources={youtube} />

      <section className="space-y-3">
        <h2 className="border-b border-zinc-200 pb-2 text-base font-semibold dark:border-zinc-800">
          추가·제외 이력
        </h2>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          아직 변경 이력이 없습니다. 목록을 바꿀 때마다 시점과 사유를 여기에
          남깁니다.
        </p>
      </section>
    </article>
  );
}

function SourceGroup({ title, sources }: { title: string; sources: Source[] }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm tabular-nums text-zinc-500">
          {sources.length}
        </span>
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <li
            key={s.id}
            className="rounded-md bg-zinc-200/70 px-2.5 py-1.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {s.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
