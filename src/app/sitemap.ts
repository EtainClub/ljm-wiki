import type { MetadataRoute } from "next";
import { getPublishedEvents } from "@/lib/events-source";
import { SITE_URL } from "@/lib/site";
import { getWikiPages } from "@/lib/wiki";

// 사건 목록과 같이 요청마다 Firestore 의 최신 발행분을 읽는다.
export const dynamic = "force-dynamic";

/**
 * 사건 페이지는 공유 링크로만 들어오고 있었다 — sitemap.xml 이 404 라
 * 검색엔진이 홈에서 7건 너머의 사건을 찾을 길이 없었다.
 * 주소는 trailingSlash 설정에 맞춰 슬래시로 끝낸다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = (await getPublishedEvents()).filter(({ event }) => !event.isSample);

  const fixed = ["", "archive", "youtube", "analysis", "changes", "guide", "w", "method", "sources"].map((path) => ({
    url: `${SITE_URL}/${path ? `${path}/` : ""}`,
  }));

  const eventUrls = events.map(({ event }) => ({
    url: `${SITE_URL}/e/${encodeURIComponent(event.slug)}/`,
    lastModified: event.publishedAt,
  }));

  const wikiUrls = getWikiPages().map((page) => ({
    url: `${SITE_URL}/w/${page.slug.map(encodeURIComponent).join("/")}/`,
  }));

  return [...fixed, ...eventUrls, ...wikiUrls];
}
