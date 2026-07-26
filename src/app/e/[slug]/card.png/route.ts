import { ImageResponse } from "next/og";
import { CARD_SIZE, buildShareCard } from "@/components/ShareCard";
import { loadCardFonts } from "@/lib/og-font";
import { getEventBySlug, getPublishedEvents } from "@/lib/events-source";
import { SITE_LABEL } from "@/lib/site";

/**
 * 세로형 공유 카드 PNG.
 *
 * 정적 export 에서 Route Handler 는 빌드 시 파일로 떨어진다(GET 만 가능).
 * 따라서 클라이언트 canvas 없이 out/e/<slug>/card.png 가 생성되고,
 * 상세 페이지의 "이미지 저장" 버튼은 이 파일을 가리키는 링크면 된다.
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

  return new ImageResponse(buildShareCard(bundle, SITE_LABEL), {
    ...CARD_SIZE,
    fonts,
  });
}
