import { ImageResponse } from "next/og";
import { SITE_OG_SIZE, buildSiteCard } from "@/components/SiteCard";
import { loadCardFonts } from "@/lib/og-font";

/**
 * 사이트 대표 링크 미리보기 이미지.
 *
 * 사건 페이지의 og.png 와 같은 이유로 규약(opengraph-image)을 쓰지 않는다 —
 * 규약을 쓰면 확장자 없는 파일이 떨어지고, 정적 호스팅은 확장자로
 * Content-Type 을 정하므로 image/png 로 나가지 않아 크롤러가 거부한다.
 */

export const dynamic = "force-static";

export async function GET() {
  const fonts = await loadCardFonts();
  return new ImageResponse(buildSiteCard(), { ...SITE_OG_SIZE, fonts });
}
