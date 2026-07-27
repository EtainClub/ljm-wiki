import type { SourceDoc } from "./domain";

/**
 * 관찰 매체 목록 — 초안.
 *
 * ⚠ 이 목록은 확정본이 아니다. `/method` 에 적은 대로 발행부수·열독률·포털 제휴
 * 같은 공개 지표로 기계적으로 정해야 하고, 그 판단은 운영자가 한다.
 * 여기 있는 것은 통신사·종합일간지·경제지·방송·인터넷매체를 폭넓게 담은 출발점일 뿐이다.
 *
 * strategy 는 2026-07-26 에 실제로 피드를 찔러 보고 정했다.
 *  - rss   : 그 시점에 200 + 항목 파싱까지 확인된 곳
 *  - naver : 공개 RSS 를 찾지 못했거나 폐지된 곳 (중앙일보는 "서비스 종료 안내" 를 반환)
 *
 * 피드는 예고 없이 죽는다. `npm run probe` 로 주기적으로 확인하고,
 * 수집기는 sources/{id}.health 에 연속 실패를 기록한다.
 */

const press = (
  id: string,
  name: string,
  domain: string,
  rssUrl: string | null,
  displayOrder: number,
  excludeHosts?: string[],
): SourceDoc => ({
  id,
  name,
  type: "press",
  active: true,
  displayOrder,
  domain,
  ...(excludeHosts ? { excludeHosts } : {}),
  ...(rssUrl ? { strategy: "rss" as const, rssUrl } : { strategy: "naver" as const }),
});

export const PRESS_SOURCES: SourceDoc[] = [
  // 통신사
  press("yna", "연합뉴스", "yna.co.kr", "https://www.yna.co.kr/rss/news.xml", 10),
  press("newsis", "뉴시스", "newsis.com", "https://newsis.com/RSS/politics.xml", 11),
  press("news1", "뉴스1", "news1.kr", null, 12),

  // 종합일간지
  press("khan", "경향신문", "khan.co.kr", "https://www.khan.co.kr/rss/rssdata/total_news.xml", 20),
  // RSS 는 살아 있지만 <pubDate> 를 아예 주지 않는다. 게시 시각이 없으면
  // 보도 지연을 잴 수 없어 발굴에 쓸 수 없다 — 네이버 전략으로 돌린다.
  press("hani", "한겨레", "hani.co.kr", null, 21),
  press(
    "chosun",
    "조선일보",
    "chosun.com",
    "https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml",
    22,
  ),
  press("joongang", "중앙일보", "joongang.co.kr", null, 23),
  press("donga", "동아일보", "donga.com", "https://rss.donga.com/total.xml", 24),
  press("hankookilbo", "한국일보", "hankookilbo.com", null, 25),
  press("seoul", "서울신문", "seoul.co.kr", "https://www.seoul.co.kr/xml/rss/rss_politics.xml", 26),
  press("kmib", "국민일보", "kmib.co.kr", "https://www.kmib.co.kr/rss/data/kmibRssAll.xml", 27),
  press(
    "segye",
    "세계일보",
    "segye.com",
    "https://www.segye.com/Articles/RSSList/segye_recent.xml",
    28,
  ),
  press("munhwa", "문화일보", "munhwa.com", null, 29),

  // 경제지
  press("hankyung", "한국경제", "hankyung.com", "https://www.hankyung.com/feed/all-news", 40),
  // mbn.mk.co.kr 은 MBN(매일방송)이다. 하위 도메인까지 매칭하면 MBN 보도가
  // 매일경제 이름으로 기록된다 — 실측에서 두 사건 모두 그렇게 잘못 잡혔다.
  press("mk", "매일경제", "mk.co.kr", "https://www.mk.co.kr/rss/30000001/", 41, [
    "mbn.mk.co.kr",
  ]),
  // https 는 TLS 협상이 깨진다. fetchFeed 가 http 로 폴백한다.
  press("edaily", "이데일리", "edaily.co.kr", "https://rss.edaily.co.kr/edaily_news.xml", 42),
  press("mt", "머니투데이", "mt.co.kr", "https://rss.mt.co.kr/mt_news.xml", 43),

  // 방송
  press("kbs", "KBS", "kbs.co.kr", null, 50),
  press("mbc", "MBC", "imbc.com", null, 51),
  press(
    "sbs",
    "SBS",
    "sbs.co.kr",
    "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01",
    52,
  ),
  // 뉴스속보 피드가 2024-10-29 에서 멈춰 있다. 200 과 유효한 RSS 를 계속
  // 돌려주므로 실패로 잡히지 않는다 — 실제로 적재해 보고서야 0건인 걸 알았다.
  press("jtbc", "JTBC", "jtbc.co.kr", null, 53),
  press("ytn", "YTN", "ytn.co.kr", null, 54),

  // 인터넷·전문지
  press("ohmynews", "오마이뉴스", "ohmynews.com", "http://rss.ohmynews.com/rss/ohmynews.xml", 60),
  press(
    "pressian",
    "프레시안",
    "pressian.com",
    "https://www.pressian.com/api/v3/site/rss/news",
    61,
  ),
  press(
    "mediatoday",
    "미디어오늘",
    "mediatoday.co.kr",
    "http://www.mediatoday.co.kr/rss/allArticle.xml",
    62,
  ),
];

/**
 * 유튜브 채널.
 *
 * 비워 둔 이유: 채널 ID 는 추측할 수 없고 잘못 넣으면 엉뚱한 채널을 수집한다.
 * 운영자가 채널 ID(UC…)를 넣으면 `seed` 스크립트가 channels.list 로
 * uploadsPlaylistId 를 1회 조회해 캐시한다. 이후 수집은 playlistItems.list
 * (호출당 1 unit)만 쓴다 — search.list 는 100 unit 이라 하루 쿼터가 즉시 마른다.
 */
export const YOUTUBE_SOURCES: SourceDoc[] = [
  // 예시:
  // { id: "yt_UCxxxxxxxxxxxxxxxxxxxxxx", name: "채널명", type: "youtube",
  //   active: true, displayOrder: 100, channelId: "UCxxxxxxxxxxxxxxxxxxxxxx" },
];

export const ALL_SOURCES: SourceDoc[] = [...PRESS_SOURCES, ...YOUTUBE_SOURCES];
