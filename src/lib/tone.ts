import type { ToneKey } from "./event-types";

/**
 * 보도 태도 — 기사·영상 하나가 정부의 결정·발언을 어떻게 다뤘는가.
 *
 * 매체가 아니라 항목에 붙는다. 큐레이터(에이전트)가 제목과 기사 리드를 읽고 분류하며,
 * 승인 PR 을 사람이 병합해야 공개된다. 정의는 /method 와 /guide 에 그대로 싣는다.
 *
 * 색은 구분용이다. 다만 유형 자체에 평가가 들어 있으므로(비난·조롱) 억지로 감추지 않는다.
 */

export interface ToneDef {
  key: ToneKey;
  label: string;
  /** 분류 기준. 화면에 그대로 싣는다. */
  description: string;
  bar: string;
}

export const TONES: ToneDef[] = [
  {
    key: "support",
    label: "지지·호평",
    description: "정부의 결정·발언을 긍정적으로 평가하거나 성과로 내세움",
    bar: "bg-sky-500",
  },
  {
    key: "report",
    label: "사실 전달",
    description: "발언·결정을 평가 없이 전함",
    bar: "bg-zinc-400",
  },
  {
    key: "critique",
    label: "정책 비판",
    description: "근거를 들어 정책·결정의 문제를 지적함",
    bar: "bg-amber-500",
  },
  {
    key: "allegation",
    label: "의혹 제기",
    description: "확인되지 않은 의혹·주장을 앞세움",
    bar: "bg-violet-500",
  },
  {
    key: "attack",
    label: "비난·조롱",
    description: "근거 없는 인신공격·조롱·비하 표현을 씀",
    bar: "bg-rose-500",
  },
  {
    key: "other",
    label: "기타",
    description: "위 어느 것에도 맞지 않음",
    bar: "bg-zinc-300 dark:bg-zinc-600",
  },
];

export function isToneKey(value: unknown): value is ToneKey {
  return TONES.some((tone) => tone.key === value);
}

export function toneDef(key: ToneKey): ToneDef {
  return TONES.find((tone) => tone.key === key)!;
}

/**
 * 부정 연상어. 정부가 잘못하고 있다는 인식과 이어지는 말이다.
 *
 * '하락'·'논란' 같은 낱말은 넣지 않는다 — 여론조사·사실 보도에도 흔히 쓰여 표시가
 * 의미를 잃는다. 지지율은 '지지율 하락' 처럼 붙은 꼴만 센다.
 */
export const CUE_TERMS = [
  "탄핵",
  "하야",
  "퇴진",
  "레임덕",
  "지지율 하락",
  "지지율 급락",
  "지지율 추락",
  "지지율 최저",
  "최저 지지율",
  "위기",
  "역풍",
  "몰락",
  "심판",
  "후폭풍",
  "자충수",
  "악재",
  "고립",
  "균열",
  "경고등",
  "빨간불",
];

/** 제목은 CJK 호환 한자(李 U+F9E1)로 오기도 한다. 비교할 때만 NFC 로 맞춘다. */
const norm = (s: string) => s.normalize("NFC");

/**
 * '겉과 속 주의' — 겉으로는 지지·호평이나 사실 전달로 분류된 제목에, 사건 제목·요약에
 * 없는 부정 연상어가 함께 실린 경우. 사건 자체가 탄핵·지지율에 관한 것이면 그 말은
 * 덧붙인 말이 아니므로 세지 않는다. 의도는 판정하지 않는다 — 덧붙은 말을 보여줄 뿐이다.
 *
 * @returns 덧붙은 부정 연상어. 해당하지 않으면 빈 배열.
 */
export function surfaceCues(title: string, tone: ToneKey, eventContext: string): string[] {
  if (tone !== "support" && tone !== "report") return [];
  const t = norm(title);
  const context = norm(eventContext);
  return CUE_TERMS.filter((term) => t.includes(term) && !context.includes(term));
}
