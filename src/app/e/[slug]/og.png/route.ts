import { ImageResponse } from "next/og";
import { OG_SIZE, buildOgCard } from "@/components/ShareCard";
import { loadCardFonts } from "@/lib/og-font";
import { getEventBySlug, getPublishedEvents } from "@/lib/events-source";

/**
 * 링크 미리보기 이미지.
 *
 * Next 의 opengraph-image 규약을 쓰지 않고 직접 라우트로 뽑는다. 규약을 쓰면
 * out/ 에 확장자 없는 `opengraph-image` 파일이 떨어지는데, 정적 파일 서버는
 * 확장자로 Content-Type 을 정하므로 image/png 로 안 나가고 크롤러가 거부한다.
 */

export const dynamicParams = false;

export async function generateStaticParams() {
  const events = await getPublishedEvents();
  return events.map((b) => ({ slug: b.event.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const bundle = await getEventBySlug(slug);
  if (!bundle) return new Response("Not found", { status: 404 });

  const fonts = await loadCardFonts();
  return new ImageResponse(buildOgCard(bundle), { ...OG_SIZE, fonts });
}
