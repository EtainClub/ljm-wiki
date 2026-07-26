import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWikiPage, getWikiPages } from "@/lib/wiki";

export const dynamicParams = false;

/**
 * 페이지 id 는 한글이다 (people/정성호). 빌드는 UTF-8 디렉터리로 떨어지고,
 * 정적 호스팅은 퍼센트 인코딩된 요청을 디코딩해 그 파일을 찾는다 —
 * `npx serve out` 으로 /w/people/%EC%A0%95%EC%84%B1%ED%98%B8/ 가 200 인 것을 확인했다.
 *
 * ⚠ 다만 `next dev` 는 인코딩된 세그먼트를 이 params 와 대조하지 못해
 *   "missing param in generateStaticParams()" 로 실패한다. 위키 페이지를
 *   로컬에서 볼 때는 `npm run build` 후 out/ 을 정적 서버로 띄워야 한다.
 */
export function generateStaticParams() {
  return getWikiPages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getWikiPage(slug.map(decodeURIComponent));
  if (!page) return {};
  return {
    title: page.title,
    description: `${page.title} — 언론 보도 기록`,
  };
}

const KIND_LABEL: Record<string, string> = {
  people: "인물",
  outlets: "매체",
  events: "사건",
  meta: "문서",
};

export default async function WikiPageView({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  // 한글 경로는 인코딩되어 들어온다.
  const page = getWikiPage(slug.map(decodeURIComponent));
  if (!page) notFound();

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs text-zinc-500">
          <Link href="/w" className="underline-offset-4 hover:underline">
            위키
          </Link>{" "}
          · {KIND_LABEL[page.kind] ?? page.kind}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
      </header>

      {/*
        위키 마크다운은 저장소에서 검토·커밋된 것만 빌드에 들어온다.
        외부 입력이 아니므로 렌더 시점의 신뢰 경계는 git 검토다.
      */}
      <div
        className="wiki-body space-y-4 text-[15px] leading-7"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </article>
  );
}
