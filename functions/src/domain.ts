import type { Timestamp } from "firebase-admin/firestore";

/**
 * Firestore 문서 타입.
 *
 * 프론트(`src/lib/event-types.ts`)와 모양이 같지만 시각 타입이 다르다
 * (여기는 Timestamp, 프론트는 ISO 문자열). 빌드 시 변환한다.
 *
 * Source 에 성향·등급 필드가 없는 것은 의도다. 고정 라벨은 낙인이 되므로
 * 분류는 사건 단위(Frame)로만 존재한다.
 */

export type SourceType = "press" | "youtube";

/** RSS 가 없거나 죽은 매체는 네이버 검색으로 대체한다. */
export type PressStrategy = "rss" | "naver";

export interface SourceDoc {
  id: string;
  name: string;
  type: SourceType;
  active: boolean;
  displayOrder: number;

  /** press 전용 */
  strategy?: PressStrategy;
  rssUrl?: string;
  /** 네이버 검색 결과에서 이 매체를 골라내기 위한 도메인 (예: "khan.co.kr") */
  domain?: string;

  /** youtube 전용 */
  channelId?: string;
  /** channels.list 로 1회 확보해 캐시한다. playlistItems.list 는 1 unit 이다. */
  uploadsPlaylistId?: string;

  /**
   * 수집기 건강 상태 — 피드가 조용히 죽는 것을 잡아낸다.
   *
   * fetch·파싱 성공만으로는 부족하다. JTBC 뉴스속보 피드는 2024-10-29 에
   * 멈춘 채로 200 과 유효한 RSS 를 계속 돌려준다. 성공으로 기록하면
   * 죽은 피드가 정상으로 보인다 — 그래서 '신선한 항목이 있었는가' 도 센다.
   */
  health?: {
    lastOkAt: Timestamp | null;
    lastErrorAt: Timestamp | null;
    lastError: string | null;
    consecutiveFailures: number;
    /** 마지막으로 48시간 이내 항목을 받은 시각 */
    lastFreshAt?: Timestamp | null;
    /** 성공했지만 신선한 항목이 0건이었던 연속 횟수 */
    consecutiveEmpty?: number;
  };
}

export interface TitleRevision {
  title: string;
  observedAt: Timestamp;
}

export interface ItemDoc {
  sourceId: string;
  /** 수집 시점 원문 그대로. 요약·재서술하지 않는다. */
  title: string;
  url: string;
  publishedAt: Timestamp;
  collectedAt: Timestamp;
  kind: "article" | "video";

  /** 최초 관측이 [0]. 길이가 1이면 변경 없음. */
  titleHistory: TitleRevision[];
  status: "live" | "title_changed" | "removed";
  lastCheckedAt: Timestamp;

  /** 큐레이션에서 채워진다 */
  eventId: string | null;
  frameKey: string | null;
}

export interface FrameDoc {
  key: string;
  /** 서술형. 평가어를 쓰지 않는다. */
  label: string;
  note?: string;
  itemIds: string[];
}

export type CoverageStatus = "covered" | "none";

export interface CoverageEntry {
  status: CoverageStatus;
  /** 이 판단이 유효한 시각. 화면에 반드시 노출한다. */
  checkedAt: Timestamp;
  itemId?: string;
  /** occurredAt 대비 보도 지연(분). covered 일 때만. */
  delayMinutes?: number;
}

export interface EventDoc {
  slug: string;
  /** "2026-07-26" (KST) */
  date: string;
  title: string;
  summary: string;
  /** 보도 지연을 재는 기준점. 틀리면 모든 지연이 틀린다. */
  occurredAt: Timestamp;

  frames: FrameDoc[];
  /** 관찰 목록 전체에 대한 보도 여부 */
  coverage: Record<string, CoverageEntry>;

  status: "draft" | "published";
  publishedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  /**
   * 위키 페이지 파일명 (wiki/events/&lt;wikiSlug&gt;.md).
   *
   * Firestore 슬러그는 해시라 읽히지 않는다(2026-07-25-acedae). 위키 링크는
   * 사람이 읽어야 하므로 별도 이름을 쓴다. 둘을 잇는 다리가 없으면
   * 생성 스크립트와 손으로 쓴 페이지가 서로 다른 링크를 만들어 깨진다.
   */
  wikiSlug?: string;

  /** 마지막 보도 확인에 쓴 질의어 — 재확인할 때 같은 걸 써야 한다 */
  coverageQuery?: string;
  editorNote?: string;
}

/** 수집기가 만들어 내는 정규화된 결과. Firestore 쓰기 직전 형태. */
export interface CollectedItem {
  sourceId: string;
  title: string;
  url: string;
  publishedAt: Date;
  kind: "article" | "video";
}

export interface CollectResult {
  sourceId: string;
  ok: boolean;
  items: CollectedItem[];
  error?: string;
}
