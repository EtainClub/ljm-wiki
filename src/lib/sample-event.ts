/**
 * 포맷 검증용 샘플 데이터.
 *
 * 매체명은 전부 가상이다. 실재 매체 이름에 지어낸 제목을 붙이면 그 자체가
 * 허위 보도 기록이 되므로, 실데이터 연결 전까지는 가상 매체만 쓴다.
 * 제목 길이·보도 시각 분포는 실제와 비슷하게 맞춰 밀도를 확인할 수 있게 했다.
 */

import type { EventBundle, Item, Source } from "./event-types";

const press = (id: string, name: string): Source => ({ id, name, type: "press" });
const tube = (id: string, name: string): Source => ({ id, name, type: "youtube" });

const SOURCES: Source[] = [
  press("saebyeok", "새벽일보"),
  press("daehan", "대한매일"),
  press("jeongo", "정오뉴스"),
  press("hanbit", "한빛신문"),
  press("mirae", "미래경제"),
  press("dongseo", "동서일보"),
  press("pureun", "푸른신문"),
  press("jeonguk", "전국일보"),
  press("sisa", "시사한판"),
  press("nuri", "누리경제"),
  press("baekje", "백제일보"),
  press("hangang", "한강신문"),
  press("saeteo", "새터뉴스"),
  press("gukmin2", "국민시사"),
  press("chungmu", "충무일보"),
  press("dalbit", "달빛경제"),
  press("odeum", "오름신문"),
  press("garam", "가람일보"),
  press("bitgoeul", "빛고을뉴스"),
  press("taeback", "태백매일"),
  tube("yt_iueum", "채널 이음"),
  tube("yt_jeongjeom", "정점토론"),
  tube("yt_maeil", "매일브리핑"),
  tube("yt_sotong", "소통라이브"),
  tube("yt_nalse", "날세움TV"),
  tube("yt_baram", "바람의언덕"),
  tube("yt_jikseon", "직선뉴스"),
  tube("yt_hansum", "한숨연구소"),
  tube("yt_yeoron", "여론의숲"),
  tube("yt_ttang", "땅과사람"),
];

const OCCURRED_AT = "2026-07-26T10:00:00+09:00";
const CHECKED_AT = "2026-07-26T21:00:00+09:00";

const RAW_ITEMS: Array<Omit<Item, "id">> = [
  // ── 성과·확대 ──────────────────────────────────────────────
  {
    sourceId: "saebyeok",
    title: "청년 월세 지원 대상 2배로… 정부 “내년부터 34만 가구”",
    url: "https://example.com/sample/1",
    publishedAt: "2026-07-26T10:24:00+09:00",
  },
  {
    sourceId: "pureun",
    title: "청년 주거비 부담 던다… 월 최대 30만원 지원 확대",
    url: "https://example.com/sample/2",
    publishedAt: "2026-07-26T10:41:00+09:00",
  },
  {
    sourceId: "hangang",
    title: "“전세 사기 걱정 줄어”… 청년 보증금 보호 범위 넓혀",
    url: "https://example.com/sample/3",
    publishedAt: "2026-07-26T11:08:00+09:00",
  },
  {
    sourceId: "yt_iueum",
    title: "[전문] 청년 주거 대책 발표 현장 — 무엇이 달라지나",
    url: "https://example.com/sample/4",
    publishedAt: "2026-07-26T12:30:00+09:00",
  },
  {
    sourceId: "bitgoeul",
    title: "지방 청년도 포함… 주거 지원 지역 제한 폐지",
    url: "https://example.com/sample/5",
    publishedAt: "2026-07-26T13:12:00+09:00",
  },
  {
    sourceId: "yt_sotong",
    title: "청년 월세 지원, 나도 받을 수 있나? 조건 정리",
    url: "https://example.com/sample/6",
    publishedAt: "2026-07-26T16:45:00+09:00",
  },

  // ── 재원·실효성 우려 ────────────────────────────────────────
  {
    sourceId: "mirae",
    title: "청년 주거 대책에 3조원… 재원 대책은 빠졌다",
    url: "https://example.com/sample/7",
    publishedAt: "2026-07-26T10:52:00+09:00",
  },
  {
    sourceId: "nuri",
    title: "“월세 올리면 그만”… 지원금이 임대료 밀어올릴 우려",
    url: "https://example.com/sample/8",
    publishedAt: "2026-07-26T11:33:00+09:00",
    titleHistory: [
      {
        title: "청년 월세 지원 확대에 “임대료 전가” 지적도",
        observedAt: "2026-07-26T11:33:00+09:00",
      },
      {
        title: "“월세 올리면 그만”… 지원금이 임대료 밀어올릴 우려",
        observedAt: "2026-07-26T14:20:00+09:00",
      },
    ],
  },
  {
    sourceId: "dalbit",
    title: "예산 3조 어디서 오나… 기재부 “구체 협의 안 됐다”",
    url: "https://example.com/sample/9",
    publishedAt: "2026-07-26T12:05:00+09:00",
  },
  {
    sourceId: "yt_jeongjeom",
    title: "청년 주거 대책, 숫자로 뜯어보니 — 3조원의 함정",
    url: "https://example.com/sample/10",
    publishedAt: "2026-07-26T15:20:00+09:00",
  },
  {
    sourceId: "taeback",
    title: "수혜 34만 가구? 실제 신청 가능 인원은 절반 이하 추산",
    url: "https://example.com/sample/11",
    publishedAt: "2026-07-26T17:02:00+09:00",
  },
  {
    sourceId: "yt_hansum",
    title: "또 현금 지원… 이번엔 다를까",
    url: "https://example.com/sample/12",
    publishedAt: "2026-07-26T19:40:00+09:00",
  },

  // ── 발표 절차·시점 ─────────────────────────────────────────
  {
    sourceId: "sisa",
    title: "당정 협의 없이 발표… 여당서도 “들은 바 없다”",
    url: "https://example.com/sample/13",
    publishedAt: "2026-07-26T13:55:00+09:00",
  },
  {
    sourceId: "garam",
    title: "국회 예산 심사 앞두고 나온 발표, 왜 지금인가",
    url: "https://example.com/sample/14",
    publishedAt: "2026-07-26T14:38:00+09:00",
    titleHistory: [
      {
        title: "청년 주거 대책 발표… 국회 예산 심사 앞두고",
        observedAt: "2026-07-26T14:38:00+09:00",
      },
      {
        title: "국회 예산 심사 앞두고 나온 발표, 왜 지금인가",
        observedAt: "2026-07-26T18:11:00+09:00",
      },
    ],
  },
  {
    sourceId: "yt_jikseon",
    title: "발표 하루 만에 말 바뀐 부처들 — 정리해봤습니다",
    url: "https://example.com/sample/15",
    publishedAt: "2026-07-26T20:15:00+09:00",
  },
];

const ITEMS: Item[] = RAW_ITEMS.map((it, i) => ({ ...it, id: `i${i + 1}` }));

const byId = <T extends { id: string }>(rows: T[]): Record<string, T> =>
  Object.fromEntries(rows.map((r) => [r.id, r]));

const itemIdsOf = (sourceIds: string[]) =>
  sourceIds.map((sid) => ITEMS.find((it) => it.sourceId === sid)!.id);

const minutesBetween = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);

const coverage: EventBundle["event"]["coverage"] = {};
for (const source of SOURCES) {
  const item = ITEMS.find((it) => it.sourceId === source.id);
  coverage[source.id] = item
    ? {
        status: "covered",
        checkedAt: CHECKED_AT,
        itemId: item.id,
        delayMinutes: minutesBetween(OCCURRED_AT, item.publishedAt),
      }
    : { status: "none", checkedAt: CHECKED_AT };
}

export const SAMPLE_EVENT: EventBundle = {
  sources: byId(SOURCES),
  items: byId(ITEMS),
  event: {
    slug: "2026-07-26-cheongnyeon-jugeo",
    date: "2026-07-26",
    title: "정부, 청년 주거 지원 대책 발표",
    summary:
      "국토교통부가 청년 월세 지원 대상을 34만 가구로 늘리고 지역 제한을 없애는 대책을 발표했다. 소요 재원은 3조원 규모로 제시됐다.",
    occurredAt: OCCURRED_AT,
    publishedAt: "2026-07-26T21:30:00+09:00",
    isSample: true,
    frames: [
      {
        key: "expand",
        label: "‘지원 확대’를 앞세움",
        note: "지원 대상·금액 증가를 제목의 주어로 삼은 경우",
        itemIds: itemIdsOf([
          "saebyeok",
          "pureun",
          "hangang",
          "yt_iueum",
          "bitgoeul",
          "yt_sotong",
        ]),
      },
      {
        key: "concern",
        label: "‘재원·실효성 우려’를 앞세움",
        note: "예산 조달, 임대료 전가, 수혜 규모 축소 가능성을 제목에 둔 경우",
        itemIds: itemIdsOf([
          "mirae",
          "nuri",
          "dalbit",
          "yt_jeongjeom",
          "taeback",
          "yt_hansum",
        ]),
      },
      {
        key: "process",
        label: "‘발표 절차·시점’을 앞세움",
        note: "정책 내용보다 발표 과정·타이밍을 제목에 둔 경우",
        itemIds: itemIdsOf(["sisa", "garam", "yt_jikseon"]),
      },
    ],
    coverage,
  },
};

export const SAMPLE_EVENTS: EventBundle[] = [SAMPLE_EVENT];

export function getEventBundle(slug: string): EventBundle | undefined {
  return SAMPLE_EVENTS.find((b) => b.event.slug === slug);
}
