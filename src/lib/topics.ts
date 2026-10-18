/**
 * 쟁점 분류.
 *
 * 사람이 사건마다 붙이지 않고, 사건 제목에 든 핵심어로 정한다. 규칙이 이 파일에
 * 그대로 있고 /guide 에 공개되므로 누가 다시 돌려도 같은 결과가 나온다 — 유튜브
 * 연결(youtubeTitleMatch)과 같은 원칙이다. 한 사건이 여러 쟁점에 들 수 있고,
 * 어디에도 들지 않을 수도 있다.
 *
 * `im` 은 임통(im.jamtong.kr/topics/...)의 같은 쟁점이다. 같은 이름을 쓰는 쟁점만
 * 잇는다 — 발언 기록(임통)과 보도 기록(속통)을 오가게 하려는 것이다.
 */

export interface Topic {
  key: string;
  label: string;
  /** 제목에 이 중 하나라도 있으면 이 쟁점이다. 사람이 읽을 수 있게 목록으로 둔다. */
  terms: string[];
  im?: string;
}

export const TOPICS: Topic[] = [
  {
    key: "prosecution-reform",
    label: "검찰개혁",
    terms: ["검찰", "보완수사", "중수청", "공소", "형사소송법", "법무부 장관"],
    im: "prosecution-reform",
  },
  {
    key: "appointments",
    label: "인사·청문회",
    terms: ["후보자", "임명", "사퇴", "사의"],
    im: "appointments-hearings",
  },
  {
    key: "diplomacy",
    label: "외교와 국익",
    terms: ["정상회담", "정상오찬", "국빈", "순방", "유엔", "CEPA", "CPTPP", "트럼프", "이집트", "브라질", "멕시코", "우크라", "민단", "경제단체"],
    im: "diplomacy-national-interest",
  },
  {
    key: "defense",
    label: "국방·안보",
    terms: ["국군", "국방", "지뢰", "DMZ", "북한", "대북", "북핵", "남북", "통일", "군공항", "포로"],
    im: "defense-security",
  },
  {
    key: "approval",
    label: "정부 평가·지지율",
    terms: ["지지율", "국정수행", "긍정평가"],
    im: "government-assessment",
  },
  {
    key: "real-estate",
    label: "집값·부동산",
    terms: ["부동산", "주택", "투기", "농지"],
    im: "real-estate",
  },
  {
    key: "constitution",
    label: "개헌",
    terms: ["개헌", "헌법"],
    im: "constitutional-amendment",
  },
  {
    key: "sns",
    label: "대통령 SNS",
    terms: ["SNS", "X에서", "리트윗", "누리꾼", "욕설계정", "좌아하게"],
  },
  {
    key: "safety",
    label: "재난·안전",
    terms: ["화재", "소방", "붕괴", "흉기", "사고", "중금속"],
  },
  {
    key: "economy",
    label: "경제·산업",
    terms: ["투자", "녹색대전환", "누리호", "북극항로", "HMM", "해양수도"],
  },
];

/** 제목은 CJK 호환 한자(李 U+F9E1)로 오기도 한다. 비교할 때만 NFC 로 맞춘다. */
const norm = (s: string) => s.normalize("NFC");

export function topicsOf(title: string): Topic[] {
  const t = norm(title);
  return TOPICS.filter((topic) => topic.terms.some((term) => t.includes(norm(term))));
}

export function getTopic(key: string): Topic | undefined {
  return TOPICS.find((topic) => topic.key === key);
}
