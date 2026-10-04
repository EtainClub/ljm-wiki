import type { Metadata } from "next";
import Link from "next/link";
import type { Source } from "@/lib/event-types";
import { getPublishedEvents } from "@/lib/events-source";
import channelAdditions from "@/data/youtube-channel-additions.json";

export const metadata: Metadata = {
  title: "수집 매체 목록",
  description:
    "관찰 대상 매체와 채널 전체 목록. 목록은 사건마다 바뀌지 않으며, 추가·제외는 이력으로 남깁니다.",
};

// 사건별 수집 현황을 Firestore의 최신 발행 상태로 표시한다.
export const dynamic = "force-dynamic";

/**
 * 목록을 통째로 공개하는 것이 이 사이트가 '전체 언론'이 아니라
 * '이 목록'을 관찰한다는 사실을 분명히 하는 유일한 방법이다.
 */
export default async function SourcesPage() {
  const events = await getPublishedEvents();
  // 사건 발행 당시 목록에 이후 검토·등록된 채널을 더한다.
  const registered = new Map<string, Source>(
    Object.values(events[0]?.sources ?? {}).map((source) => [source.id, source]),
  );
  for (const channel of channelAdditions) {
    registered.set(channel.id, { id: channel.id, name: channel.name, type: "youtube" });
  }
  const all = [...registered.values()].sort((a, b) =>
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
          빠진 것이 아니라 아직 관련 기록이 연결되지 않았을 수 있습니다.
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
          <li>언론 매체 목록은 외부에 공개된 지표를 기준으로 정합니다</li>
          <li>언론은 발행부수·열독률·포털 제휴 여부 등을 봅니다</li>
          <li>유튜브는 이재명 관련 보도·논평 제목을 반복적으로 게시하는 채널을 조사하고, 실제 채널 ID와 영상 사례를 확인해 등록합니다</li>
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
      <Link href="/youtube" className="inline-block text-sm underline underline-offset-4">
        유튜브 채널별 제목·사건 기록 비교
      </Link>

      <section className="space-y-3">
        <h2 className="border-b border-zinc-200 pb-2 text-base font-semibold dark:border-zinc-800">
          추가·제외 이력
        </h2>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          2026년 10월 3일 — 이재명 관련 보도·논평을 반복적으로 다루는 채널
          {" "}{channelAdditions.length}곳을 추가했습니다. 각 채널의 고유 ID와 관련 영상
          제목을 YouTube API로 확인했습니다. 등록된 영상은 사건 관련성을 검토한 뒤
          공개 기록에 연결합니다.
        </p>
        <details className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-medium">추가 채널과 선정 근거 영상</summary>
          <ul className="mt-4 space-y-3 text-sm">
            {channelAdditions.map((channel) => (
              <li key={channel.id}>
                <a href={`https://www.youtube.com/channel/${channel.channelId}`} className="underline underline-offset-4">{channel.name}</a>
                {channel.evidenceUrls.map((url, index) => (
                  <a key={url} href={url} className="ml-3 text-zinc-500 underline underline-offset-4">관련 영상 {index + 1}</a>
                ))}
              </li>
            ))}
          </ul>
        </details>
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
      {sources.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <li
              key={s.id}
              className="rounded-md bg-zinc-200/70 px-2.5 py-1.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {s.type === "youtube" && /^yt_UC[\w-]{22}$/.test(s.id) ? (
                <a href={`https://www.youtube.com/channel/${s.id.slice(3)}`} className="underline underline-offset-4">{s.name}</a>
              ) : s.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          아직 등록된 채널이 없습니다. 채널 ID를 확인한 뒤에만 추가합니다.
        </p>
      )}
    </section>
  );
}
