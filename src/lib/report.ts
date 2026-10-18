import { BRAND } from "./brand";
import { REPO_URL, SITE_URL } from "./site";

/**
 * '빠진 기사' 제보 링크.
 *
 * 미보도 판정은 검색어에 달려 있어 실제로 보도한 매체가 빠질 수 있다. 독자가 찾은
 * 기사가 판정을 고칠 가장 빠른 근거라, 사건 주소와 적을 칸을 미리 채워 둔다.
 * 입력을 받는 서버가 따로 없다 — 공개 이슈 또는 메일로만 받는다.
 */
export function missingArticleLinks(event: { slug: string; title: string }) {
  const url = `${SITE_URL}/e/${encodeURIComponent(event.slug)}/`;
  const body = [
    `사건: ${event.title}`,
    `사건 페이지: ${url}`,
    "",
    "빠진 기사·영상 원문 링크:",
    "매체·채널 이름:",
    "덧붙일 말 (선택):",
  ].join("\n");

  return {
    issue: `${REPO_URL}/issues/new?${new URLSearchParams({
      title: `[빠진 기사] ${event.title}`,
      body,
    })}`,
    mail: `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent(
      `[${BRAND.name} 빠진 기사] ${event.title}`,
    )}&body=${encodeURIComponent(body)}`,
  };
}
