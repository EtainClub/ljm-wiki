/**
 * 사건(Event) 도메인 타입.
 *
 * 설계 원칙 두 가지가 타입에 박혀 있다.
 *  1. Source 에 성향·등급 필드가 없다. 매체에 고정 라벨을 붙이는 순간 낙인이 된다.
 *     분류는 사건 단위(Frame)로만 존재한다.
 *  2. Item.url 은 optional 이 아니다. 원문 링크 없는 제목은 렌더할 수 없다.
 */

export type SourceType = "press" | "youtube";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
}

export interface TitleRevision {
  title: string;
  observedAt: string; // ISO 8601
}

export interface Item {
  id: string;
  sourceId: string;
  /** 수집 시점 원문 그대로. 요약·재서술하지 않는다. */
  title: string;
  url: string;
  publishedAt: string; // ISO 8601
  /** 제목이 바뀐 이력. 최초 관측이 [0]. 비어 있으면 변경 없음. */
  titleHistory?: TitleRevision[];
}

export interface Frame {
  key: string;
  /** 서술형으로 쓴다. 평가어("왜곡", "악의적")를 쓰지 않는다. */
  label: string;
  note?: string;
  itemIds: string[];
}

export type CoverageStatus = "covered" | "none";

export interface CoverageEntry {
  status: CoverageStatus;
  /** 이 판단이 유효한 시각. 화면에 반드시 노출한다. */
  checkedAt: string;
  itemId?: string;
  /** occurredAt 대비 보도 지연(분). covered 일 때만. */
  delayMinutes?: number;
}

export interface EventDoc {
  slug: string;
  date: string; // "2026-07-26" (KST)
  title: string;
  summary: string;
  /** 시간차 계산의 기준점 */
  occurredAt: string;
  frames: Frame[];
  coverage: Record<string, CoverageEntry>;
  publishedAt: string;
  /**
   * 보도 여부를 판정할 때 쓴 검색어.
   *
   * 화면에 노출한다. '보도하지 않음' 은 이 문자열에 달린 값이기 때문이다 —
   * 실측에서 검색어를 바꾸자 같은 사건·같은 시간창인데 미보도가 6곳에서 0곳이 됐다.
   * 근거를 감춘 채로 실존 매체가 다루지 않았다고 적을 수는 없다.
   */
  coverageQuery?: string;
  /** 개발 중 샘플 데이터 표시. 실제 발행분은 false. */
  isSample?: boolean;
}

/** 페이지 렌더에 필요한 것을 한 번에 담은 뷰모델. */
export interface EventBundle {
  event: EventDoc;
  sources: Record<string, Source>;
  items: Record<string, Item>;
}
