import { createHash } from "node:crypto";

/**
 * 항목 문서 id 는 URL 해시다.
 *
 * 같은 기사를 매 수집 주기마다 다시 만나므로, id 가 URL 로 결정되어야
 * set(merge) 만으로 중복 없이 갱신된다. 그리고 제목이 바뀌었을 때
 * "같은 기사인데 제목만 달라졌다" 를 알아볼 수 있다 — 이게 제목 변경 추적의 토대다.
 */

/** 추적 파라미터와 대소문자 차이로 같은 기사가 갈라지는 것을 막는다. */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol === "http:") url.protocol = "https:";

    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|igshid|ref|cmpid)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();

    // 물음표 없이 경로에 추적 조각을 붙여 보내는 곳이 있다.
    // 프레시안: /pages/articles/2026...844&ref=rss
    // 조각을 떼도 같은 기사가 열리는 것을 확인했다(2026-07-26).
    if (!url.search) {
      url.pathname = url.pathname.replace(
        /&(?:ref|utm_[a-z]+|cmpid|fbclid)=[^&/]*$/i,
        "",
      );
    }

    let out = url.toString();
    if (out.endsWith("/") && url.pathname !== "/") out = out.slice(0, -1);
    return out;
  } catch {
    return raw.trim();
  }
}

export function itemIdFor(url: string): string {
  return createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 20);
}
