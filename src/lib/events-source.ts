import "server-only";

import type { EventBundle, Frame, Item, Source } from "./event-types";
import { firebaseProjectId } from "./firebase-project";
import { SAMPLE_EVENTS } from "./sample-event";

/**
 * 빌드 타임 데이터 소스.
 *
 * 정적 export 라 Server Component 가 `next build` 중에 실행된다. 그때
 * Admin SDK 로 Firestore 를 읽어 HTML 에 구워 넣는다. 브라우저는 Firestore 에
 * 접근하지 않는다 (firestore.rules 는 전면 deny).
 *
 * 자격증명이 없거나 발행된 사건이 아직 없으면 샘플로 떨어진다. 조용히 빈
 * 사이트를 내보내는 것보다, 무엇이 왜 빠졌는지 빌드 로그에 남기는 편이 낫다.
 */

type FirestoreLike = {
  collection: (path: string) => {
    where: (a: string, b: string, c: unknown) => { get: () => Promise<QuerySnap> };
    get: () => Promise<QuerySnap>;
  };
  getAll: (...refs: unknown[]) => Promise<DocSnap[]>;
  doc: (path: string) => unknown;
};

interface DocSnap {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}
interface QuerySnap {
  docs: DocSnap[];
}

/** Firestore Timestamp → ISO 문자열. 프론트 타입은 문자열만 다룬다. */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

async function connect(): Promise<FirestoreLike | null> {
  // .firebaserc 가 기본값이다 — 환경변수 없이 clone 해서 빌드해도 진짜 데이터가 나온다.
  const projectId = firebaseProjectId();
  if (!projectId) return null;

  try {
    // 정적 페이지 생성 시점에만 필요하다. 클라이언트 번들과 무관하도록 동적 import 한다.
    const { getApps, initializeApp, applicationDefault } = await import(
      "firebase-admin/app"
    );
    const { getFirestore } = await import("firebase-admin/firestore");

    if (getApps().length === 0) {
      initializeApp({ projectId, credential: applicationDefault() });
    }
    return getFirestore() as unknown as FirestoreLike;
  } catch (e) {
    console.warn(
      `[events-source] Firestore 연결 실패 — 샘플 데이터로 빌드합니다: ${
        e instanceof Error ? e.message : e
      }`,
    );
    return null;
  }
}

function buildBundle(
  eventDoc: Record<string, unknown>,
  slug: string,
  sources: Record<string, Source>,
  items: Record<string, Item>,
): EventBundle | null {
  const occurredAt = toIso(eventDoc["occurredAt"]);
  const publishedAt = toIso(eventDoc["publishedAt"]);
  if (!occurredAt || !publishedAt) return null;

  // Firestore 배열은 큐레이션에서 프레임을 만든 순서다. 그대로 내보내면
  // 3건짜리가 9건짜리보다 앞에 오는 일이 생긴다(실제로 정성호 사의 사건이 그랬다).
  // 큰 묶음부터, 같으면 먼저 나온 기사가 있는 쪽부터 — 화면의 비율 막대와 같은 순서다.
  const earliest = (f: Frame): number => {
    const times = f.itemIds
      .map((id) => items[id]?.publishedAt)
      .filter((t): t is string => Boolean(t))
      .map((t) => Date.parse(t));
    return times.length > 0 ? Math.min(...times) : Number.POSITIVE_INFINITY;
  };
  const at = (id: string): number => {
    const t = items[id]?.publishedAt;
    return t ? Date.parse(t) : Number.POSITIVE_INFINITY;
  };
  const frames = [...((eventDoc["frames"] as Frame[] | undefined) ?? [])]
    // 묶음 안에서도 이른 기사가 먼저다. 배열 순서는 큐레이션에서 적어 넣은 순서일 뿐이다.
    .map((f) => ({ ...f, itemIds: [...f.itemIds].sort((x, y) => at(x) - at(y)) }))
    .sort((a, b) => b.itemIds.length - a.itemIds.length || earliest(a) - earliest(b));

  // coverage 의 checkedAt 도 Timestamp 다.
  const rawCoverage = (eventDoc["coverage"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const coverage: EventBundle["event"]["coverage"] = {};
  for (const [sourceId, entry] of Object.entries(rawCoverage)) {
    const checkedAt = toIso(entry["checkedAt"]);
    if (!checkedAt) continue;
    coverage[sourceId] = {
      status: entry["status"] === "covered" ? "covered" : "none",
      checkedAt,
      ...(typeof entry["itemId"] === "string" ? { itemId: entry["itemId"] } : {}),
      ...(typeof entry["delayMinutes"] === "number"
        ? { delayMinutes: entry["delayMinutes"] }
        : {}),
    };
  }

  return {
    event: {
      slug,
      date: String(eventDoc["date"] ?? ""),
      title: String(eventDoc["title"] ?? ""),
      summary: String(eventDoc["summary"] ?? ""),
      occurredAt,
      publishedAt,
      frames,
      coverage,
      ...(typeof eventDoc["coverageQuery"] === "string"
        ? { coverageQuery: eventDoc["coverageQuery"] }
        : {}),
    },
    sources,
    items,
  };
}

/**
 * 빌드 중 여러 페이지가 호출하므로 모듈 안에서 한 번만 읽는다.
 *
 * 다만 Next 는 정적 생성을 워커 여러 개로 나눠 돌리고 워커마다 모듈이 따로
 * 로드되므로, 실제로는 워커 수만큼 읽는다(빌드 로그에 경고가 여러 번 찍히는 이유).
 * 사건 수가 적어 문제되지 않지만, 데이터가 커지면 빌드 전에 한 번 덤프해
 * 파일로 넘기는 편이 낫다.
 */
let cache: EventBundle[] | null = null;

/**
 * 발행된 사건 전체. 빌드 중 여러 페이지가 호출하므로 한 번만 읽는다.
 * 최신순 정렬.
 */
export async function getPublishedEvents(): Promise<EventBundle[]> {
  if (cache) return cache;

  const db = await connect();
  if (!db) {
    console.warn(
      "[events-source] 프로젝트 id 를 찾지 못했습니다 (.firebaserc 도, FIREBASE_PROJECT_ID 도)" +
        " — 샘플 데이터로 빌드합니다.",
    );
    cache = SAMPLE_EVENTS;
    return cache;
  }

  try {
    const [eventsSnap, sourcesSnap] = await Promise.all([
      db.collection("events").where("status", "==", "published").get(),
      db.collection("sources").get(),
    ]);

    if (eventsSnap.docs.length === 0) {
      console.warn(
        "[events-source] 발행된 사건이 없습니다 — 샘플 데이터로 빌드합니다.",
      );
      cache = SAMPLE_EVENTS;
      return cache;
    }

    const sources: Record<string, Source> = {};
    for (const doc of sourcesSnap.docs) {
      const d = doc.data();
      if (!d) continue;
      sources[doc.id] = {
        id: doc.id,
        name: String(d["name"] ?? doc.id),
        type: d["type"] === "youtube" ? "youtube" : "press",
      };
    }

    // 모든 사건이 참조하는 항목을 한 번에 읽는다.
    const itemIds = new Set<string>();
    for (const doc of eventsSnap.docs) {
      const frames = (doc.data()?.["frames"] as Frame[] | undefined) ?? [];
      for (const frame of frames) for (const id of frame.itemIds) itemIds.add(id);
    }

    const items: Record<string, Item> = {};
    const ids = [...itemIds];
    for (let i = 0; i < ids.length; i += 300) {
      const refs = ids.slice(i, i + 300).map((id) => db.doc(`items/${id}`));
      const snaps = await db.getAll(...refs);
      for (const snap of snaps) {
        const d = snap.data();
        const publishedAt = toIso(d?.["publishedAt"]);
        if (!d || !snap.exists || !publishedAt) continue;

        const history = (d["titleHistory"] as Array<Record<string, unknown>> | undefined) ?? [];
        items[snap.id] = {
          id: snap.id,
          sourceId: String(d["sourceId"] ?? ""),
          title: String(d["title"] ?? ""),
          url: String(d["url"] ?? ""),
          publishedAt,
          titleHistory: history
            .map((h) => ({ title: String(h["title"] ?? ""), observedAt: toIso(h["observedAt"]) }))
            .filter((h): h is { title: string; observedAt: string } => h.observedAt !== null),
        };
      }
    }

    const bundles: EventBundle[] = [];
    for (const doc of eventsSnap.docs) {
      const data = doc.data();
      if (!data) continue;
      const bundle = buildBundle(data, doc.id, sources, items);
      if (bundle) bundles.push(bundle);
      else console.warn(`[events-source] 사건 ${doc.id} 을 건너뜁니다 — 필수 시각 누락`);
    }

    bundles.sort((a, b) => b.event.date.localeCompare(a.event.date));
    console.log(`[events-source] Firestore 에서 사건 ${bundles.length}건을 읽었습니다.`);
    cache = bundles;
    return cache;
  } catch (e) {
    console.warn(
      `[events-source] Firestore 읽기 실패 — 샘플 데이터로 빌드합니다: ${
        e instanceof Error ? e.message : e
      }`,
    );
    cache = SAMPLE_EVENTS;
    return cache;
  }
}

export async function getEventBySlug(slug: string): Promise<EventBundle | undefined> {
  const all = await getPublishedEvents();
  return all.find((b) => b.event.slug === slug);
}
