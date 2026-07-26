import type { CollectedItem } from "../domain";

/**
 * 네이버 뉴스 검색 API.
 *
 * 두 가지 용도가 다르다는 점이 중요하다.
 *
 *  1. 발굴(discovery) — RSS 가 담당한다. 매체별 최신 기사를 계속 끌어와 후보 풀을 만든다.
 *  2. 보도 여부 확인(coverage) — 이쪽이 네이버의 자리다.
 *     "이 매체가 '이 사건'을 다뤘는가" 는 사건이 정해진 뒤에야 물을 수 있고,
 *     검색은 질의어를 요구하기 때문이다.
 *
 * RSS 가 있는 매체도 보도 여부 확인에는 네이버를 함께 쓴다. RSS 가 전체 기사를
 * 담지 않는 경우가 있어 '보도하지 않음' 을 잘못 찍을 위험이 있기 때문이다.
 *
 * 무료 한도는 일 25,000 건이다. 사건 1건 × 매체 30곳이라도 여유가 크다.
 */

const ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

/** 한 번에 받을 수 있는 최대치 */
const DISPLAY = 100;
/** start 파라미터 상한 — 그 이상은 API 가 거절한다 */
const MAX_START = 1000;
/** 사건 1건에 쓸 검색 호출 상한. 10회 × 100건 = 1000건까지 훑는다. */
const MAX_PAGES = 10;

export interface NaverCredentials {
  clientId: string;
  clientSecret: string;
}

export interface SearchHit {
  title: string;
  url: string;
  publishedAt: Date;
  host: string;
}

interface NaverItem {
  title: string;
  originallink: string;
  link: string;
  pubDate: string;
}

/** 검색 결과 제목에는 <b> 강조 태그와 HTML 엔티티가 섞여 온다. */
function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** host 가 domain 자신이거나 그 하위 도메인인가 */
function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export async function searchNews(
  query: string,
  creds: NaverCredentials,
  opts: { since?: Date; maxPages?: number } = {},
): Promise<{ results: SearchHit[]; truncated: boolean; calls: number }> {
  // sort=date 는 최신순이다. since 보다 오래된 결과가 나오면 그 뒤는 볼 필요가 없다 —
  // 이 성질 덕분에 해당 시간대를 빠짐없이 훑을 수 있다.
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const results: SearchHit[] = [];
  let calls = 0;
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    const start = page * DISPLAY + 1;
    if (start > MAX_START) {
      truncated = true;
      break;
    }

    const url =
      `${ENDPOINT}?query=${encodeURIComponent(query)}` +
      `&display=${DISPLAY}&start=${start}&sort=date`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": creds.clientId,
        "X-Naver-Client-Secret": creds.clientSecret,
      },
    });
    calls++;
    if (!res.ok) {
      throw new Error(
        `네이버 검색 실패: HTTP ${res.status} ${await res.text().catch(() => "")}`,
      );
    }

    const body = (await res.json()) as { items?: NaverItem[] };
    const items = body.items ?? [];
    let reachedOlder = false;

    for (const item of items) {
      // originallink 가 원 매체 주소다. link 는 네이버 뉴스 주소일 수 있어 매체 판별에 못 쓴다.
      const link = item.originallink || item.link;
      const publishedAt = new Date(item.pubDate);
      if (!link || Number.isNaN(publishedAt.getTime())) continue;

      if (opts.since && publishedAt < opts.since) {
        reachedOlder = true;
        continue;
      }
      results.push({
        title: cleanTitle(item.title),
        url: link,
        publishedAt,
        host: hostOf(link),
      });
    }

    // 시간창 바깥으로 넘어갔거나 마지막 페이지면 멈춘다.
    if (reachedOlder || items.length < DISPLAY) break;

    // 끝 페이지까지 갔는데도 시간창을 못 벗어났다면 결과가 잘린 것이다.
    if (page === maxPages - 1) truncated = true;
  }

  return { results, truncated, calls };
}

export interface CoverageTarget {
  sourceId: string;
  domain: string;
}

export interface CoverageOutcome {
  /** 도메인이 일치한 기사들 (시각 오름차순) */
  covered: Map<string, CollectedItem[]>;
  /** 어느 매체에도 매칭되지 않은 결과 수 — 질의어가 너무 넓은지 가늠하는 데 쓴다 */
  unmatched: number;
  /** 실제로 조회한 결과 수 */
  scanned: number;
  /**
   * 시간창을 다 훑지 못하고 끊겼는가.
   *
   * true 면 '보도하지 않음' 을 사실로 쓸 수 없다 — 실제로 보도한 매체가
   * 잘려 나갔을 수 있기 때문이다. 이 표시는 사이트에 사실로 실리므로
   * truncated 인 채로 발행해서는 안 된다.
   */
  truncated: boolean;
  /** 사용한 검색 호출 수 (일 25,000회 한도 대비) */
  calls: number;
}

/**
 * 여러 매체의 보도 여부를 한 번에 판정한다.
 *
 * 매체마다 검색을 부르면 사건 1건에 25회를 쓴다. 검색 결과에는 모든 매체가
 * 섞여 오므로 한 번 부르고 도메인으로 나누면 1회로 끝난다.
 * (한도는 전체 카테고리 합산 하루 25,000회다 — 아끼는 편이 낫다.)
 *
 * 한 번만 부르면 안 된다. display 상한이 100 이고 결과에는 목록 밖 매체가
 * 대량으로 섞여 오기 때문에, 실제로 보도한 매체가 100건 밖으로 밀려
 * '보도하지 않음' 으로 잘못 찍힌다. 실측에서 질의어를 바꾸자 같은 사건·같은
 * 시간창인데 판정이 뒤집혔다(서울신문·프레시안).
 *
 * 그래서 sort=date 의 최신순 성질을 이용해 since 를 지날 때까지 페이지를
 * 넘긴다. 시간창을 다 훑지 못했으면 truncated 로 알린다.
 */
export async function checkCoverage(
  targets: CoverageTarget[],
  query: string,
  creds: NaverCredentials,
  since?: Date,
): Promise<CoverageOutcome> {
  const { results, truncated, calls } = await searchNews(query, creds, { since });
  const covered = new Map<string, CollectedItem[]>();
  let unmatched = 0;

  for (const r of results) {
    const target = targets.find((t) => matchesDomain(r.host, t.domain));
    if (!target) {
      unmatched++;
      continue;
    }

    const list = covered.get(target.sourceId) ?? [];
    list.push({
      sourceId: target.sourceId,
      title: r.title,
      url: r.url,
      publishedAt: r.publishedAt,
      kind: "article",
    });
    covered.set(target.sourceId, list);
  }

  for (const list of covered.values()) {
    list.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  }

  return { covered, unmatched, scanned: results.length, truncated, calls };
}
