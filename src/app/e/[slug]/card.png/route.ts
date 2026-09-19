import { ImageResponse } from "next/og";
import { CARD_SIZE, buildShareCard } from "@/components/ShareCard";
import { loadCardFonts } from "@/lib/og-font";
import { getEventBySlug } from "@/lib/events-source";
import { SITE_LABEL } from "@/lib/site";

/**
 * 세로형 공유 카드 PNG.
 *
 * App Hosting의 Route Handler가 PNG를 서버에서 만든다. 클라이언트 canvas 없이
 * 상세 페이지의 "이미지 저장" 버튼은 이 경로를 가리키는 링크면 된다.
 */

export const dynamic = "force-dynamic";

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
