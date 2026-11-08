import "server-only";

import type { EventBundle, Frame, Item, Source, ToneEntry, YouTubeTitleMatch } from "./event-types";
import { isToneKey } from "./tone";
import { firebaseProjectId } from "./firebase-project";
import { SAMPLE_EVENTS } from "./sample-event";
import { isRecentLeeVideo, type RecentVideo } from "./youtube-records";

/**
 * 서버 데이터 소스.
 *
 * App Hosting의 Server Component/Route Handler가 Admin SDK로 Firestore를 읽는다.
 * 브라우저는 Firestore에 접근하지 않는다 (firestore.rules 는 전면 deny).
 *
 * 로컬 개발에서 자격증명이 없거나 발행된 사건이 아직 없으면 샘플로 떨어진다.
 */

interface QueryLike {
  where: (a: string, b: string, c: unknown) => QueryLike;
  orderBy: (field: string, direction: "desc" | "asc") => QueryLike;
  limit: (count: number) => QueryLike;
  get: () => Promise<QuerySnap>;
}

type FirestoreLike = {
  collection: (path: string) => QueryLike;
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
    // 클라이언트 번들과 무관하도록 동적 import 한다.
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

  // 여러 사건의 항목을 한 번에 읽더라도 각 화면에는 이 사건이 참조한 항목만 전달한다.
  const eventItems: Record<string, Item> = {};
  for (const frame of frames) {
    for (const id of frame.itemIds) {
      if (items[id]) eventItems[id] = items[id];
    }
  }

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
      ...(entry["reason"] === "not_found" || entry["reason"] === "dropped"
        ? { reason: entry["reason"] }
        : {}),
      ...(typeof entry["itemId"] === "string" ? { itemId: entry["itemId"] } : {}),
      ...(typeof entry["delayMinutes"] === "number"
        ? { delayMinutes: entry["delayMinutes"] }
        : {}),
    };
  }

  // 화면에 나가는 항목의 분류만 넘긴다. 알 수 없는 유형은 버린다 — 정의 없는 라벨을 그릴 수 없다.
  const rawTones = (eventDoc["tones"] ?? {}) as Record<string, Record<string, unknown>>;
  const tones: Record<string, ToneEntry> = {};
  for (const [itemId, entry] of Object.entries(rawTones)) {
    if (!eventItems[itemId] || !isToneKey(entry["tone"]) || typeof entry["basis"] !== "string") continue;
    tones[itemId] = { tone: entry["tone"], basis: entry["basis"] };
  }

  const rawYouTubeMatch = eventDoc["youtubeTitleMatch"] as Record<string, unknown> | undefined;
  const matchedAt = toIso(rawYouTubeMatch?.["matchedAt"]);
  const youtubeTitleMatch: YouTubeTitleMatch | undefined =
    rawYouTubeMatch &&
    matchedAt &&
    Array.isArray(rawYouTubeMatch["terms"]) &&
    Array.isArray(rawYouTubeMatch["requiredTerms"]) &&
    typeof rawYouTubeMatch["minimumMatches"] === "number" &&
    typeof rawYouTubeMatch["windowBeforeHours"] === "number" &&
    typeof rawYouTubeMatch["windowAfterHours"] === "number"
      ? {
          terms: rawYouTubeMatch["terms"].filter(
            (term): term is string => typeof term === "string",
          ),
          requiredTerms: rawYouTubeMatch["requiredTerms"].filter(
            (term): term is string => typeof term === "string",
          ),
          minimumMatches: rawYouTubeMatch["minimumMatches"],
          windowBeforeHours: rawYouTubeMatch["windowBeforeHours"],
          windowAfterHours: rawYouTubeMatch["windowAfterHours"],
          matchedAt,
        }
      : undefined;

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
      ...(typeof eventDoc["revision"] === "number" ? { revision: eventDoc["revision"] } : {}),
      ...(toIso(eventDoc["revisedAt"]) ? { revisedAt: toIso(eventDoc["revisedAt"])! } : {}),
      ...(youtubeTitleMatch ? { youtubeTitleMatch } : {}),
      ...(typeof eventDoc["coverageQuery"] === "string"
        ? { coverageQuery: eventDoc["coverageQuery"] }
        : {}),
      ...(Object.keys(tones).length > 0 ? { tones } : {}),
    },
    sources,
    items: eventItems,
  };
}

/**
 * 인스턴스 메모리 캐시.
 *
 * 예전에는 모든 요청이 발행 사건·매체·참조 기사 전부(사건 108건 기준 2,087 읽기)를 다시 읽었다.
 * 봇 한 번, 공유 링크 한 번이 수천 건의 Firestore 읽기가 되어 비용 전부가 여기서 나왔다.
 * 같은 키는 TTL 동안 같은 Promise 를 돌려준다 — 한 요청 안의 중복 호출(generateMetadata 와
 * 페이지 본문)과 동시 요청도 한 번의 읽기로 합쳐진다. 발행은 최대 TTL 만큼 늦게 반영된다.
 * 실패한 읽기는 캐시하지 않는다 — 샘플 대체 화면이 TTL 동안 굳지 않게 한다.
 */
const CACHE_TTL_MS = 5 * 60_000;
// 라우트마다 모듈 인스턴스가 따로 생길 수 있어 프로세스 전역에 둔다 — 그래야 sitemap·페이지·OG 가 한 캐시를 쓴다.
const memoHolder = globalThis as typeof globalThis & {
  __eventsSourceMemo?: Map<string, { at: number; value: Promise<unknown> }>;
};
const memo = (memoHolder.__eventsSourceMemo ??= new Map());

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value as Promise<T>;

  // 없는 slug 를 훑는 봇이 키를 무한정 늘리지 않도록 만료된 항목을 치운다.
  for (const [k, entry] of memo) if (now - entry.at >= CACHE_TTL_MS) memo.delete(k);

  const value = load();
  memo.set(key, { at: now, value });
  value.catch(() => {
    if (memo.get(key)?.value === value) memo.delete(key);
  });
  return value;
}

function loadSources(db: FirestoreLike): Promise<Record<string, Source>> {
  return cached("sources", async () => {
    const snap = await db.collection("sources").get();
    const sources: Record<string, Source> = {};
    for (const doc of snap.docs) {
      const d = doc.data();
      if (!d) continue;
      sources[doc.id] = {
        id: doc.id,
        name: String(d["name"] ?? doc.id),
        type: d["type"] === "youtube" ? "youtube" : "press",
      };
    }
    return sources;
  });
}

async function loadItems(db: FirestoreLike, ids: string[]): Promise<Record<string, Item>> {
  const items: Record<string, Item> = {};
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
  return items;
}

function referencedItemIds(eventDocs: Array<Record<string, unknown> | undefined>): string[] {
  const ids = new Set<string>();
  for (const data of eventDocs) {
    const frames = (data?.["frames"] as Frame[] | undefined) ?? [];
    for (const frame of frames) for (const id of frame.itemIds) ids.add(id);
  }
  return [...ids];
}

/** Firestore 의 발행 사건 전체. 읽기 실패는 throw 한다 (캐시되지 않게). */
function loadPublishedEvents(db: FirestoreLike): Promise<EventBundle[]> {
  return cached("published", async () => {
    const [eventsSnap, sources] = await Promise.all([
      db.collection("events").where("status", "==", "published").get(),
      loadSources(db),
    ]);
    if (eventsSnap.docs.length === 0) return [];

    // 모든 사건이 참조하는 항목을 한 번에 읽는다.
    const items = await loadItems(db, referencedItemIds(eventsSnap.docs.map((d) => d.data())));

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
    return bundles;
  });
}

/**
 * 발행된 사건 전체, 최신순. 최대 CACHE_TTL_MS 동안 인스턴스 메모리 캐시를 쓴다.
 */
export async function getPublishedEvents(): Promise<EventBundle[]> {
  const db = await connect();
  if (!db) {
    console.warn(
      "[events-source] 프로젝트 id 를 찾지 못했습니다 (.firebaserc 도, FIREBASE_PROJECT_ID 도)" +
        " — 샘플 데이터로 빌드합니다.",
    );
    return SAMPLE_EVENTS;
  }

  try {
    const bundles = await loadPublishedEvents(db);
    if (bundles.length === 0) {
      console.warn("[events-source] 발행된 사건이 없습니다 — 샘플 데이터로 빌드합니다.");
      return SAMPLE_EVENTS;
    }
    return bundles;
  } catch (e) {
    console.warn(
      `[events-source] Firestore 읽기 실패 — 샘플 데이터로 빌드합니다: ${
        e instanceof Error ? e.message : e
      }`,
    );
    return SAMPLE_EVENTS;
  }
}

/**
 * 사건 하나. 전체 목록이 이미 캐시돼 있으면 거기서 꺼내고(읽기 0),
 * 아니면 그 사건 문서와 그 사건이 참조한 기사만 읽는다(수십 건).
 */
export async function getEventBySlug(slug: string): Promise<EventBundle | undefined> {
  const db = await connect();
  if (!db) return SAMPLE_EVENTS.find((b) => b.event.slug === slug);

  const warm = memo.get("published");
  if (warm && Date.now() - warm.at < CACHE_TTL_MS) {
    try {
      const all = (await warm.value) as EventBundle[];
      return all.find((b) => b.event.slug === slug);
    } catch {
      // 전체 읽기가 실패했다 — 아래 단건 읽기로 간다.
    }
  }

  try {
    return await cached(`event:${slug}`, async () => {
      const eventSnap = (await db.getAll(db.doc(`events/${slug}`)))[0];
      const data = eventSnap?.exists ? eventSnap.data() : undefined;
      if (!data || data["status"] !== "published") return undefined;
      const [sources, items] = await Promise.all([
        loadSources(db),
        loadItems(db, referencedItemIds([data])),
      ]);
      return buildBundle(data, slug, sources, items) ?? undefined;
    });
  } catch (e) {
    console.warn(
      `[events-source] 사건 ${slug} 읽기 실패 — 샘플에서 찾습니다: ${
        e instanceof Error ? e.message : e
      }`,
    );
    return SAMPLE_EVENTS.find((b) => b.event.slug === slug);
  }
}

/** 최근 7일 등록 채널의 원제. 미발행 사건에 배정된 항목은 공개하지 않는다. */
export async function getRecentYouTubeVideos(): Promise<{
  videos: RecentVideo[];
  available: boolean;
  checkedAt: string;
}> {
  const db = await connect();
  if (!db) return { videos: [], available: false, checkedAt: new Date().toISOString() };
  try {
    return await cached("recent-youtube", () => loadRecentYouTubeVideos(db));
  } catch (error) {
    console.error("[youtube] 최근 영상 제목 조회 실패", error instanceof Error ? error.message : error);
    return { videos: [], available: false, checkedAt: new Date().toISOString() };
  }
}

async function loadRecentYouTubeVideos(db: FirestoreLike): Promise<{
  videos: RecentVideo[];
  available: boolean;
  checkedAt: string;
}> {
  const now = new Date();
  const checkedAt = now.toISOString();
  // 발행 여부는 캐시된 발행 목록에서 가져온다 — events 컬렉션을 따로 다시 읽지 않는다.
  const [sourcesSnap, publishedBundles] = await Promise.all([
    db.collection("sources").where("type", "==", "youtube").get(),
    loadPublishedEvents(db),
  ]);
  const published = new Set(publishedBundles.map((b) => b.event.slug));
  const sources = sourcesSnap.docs.filter((doc) => doc.data()?.["active"] === true);
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const videos: RecentVideo[] = [];
  // 기존 sourceId·publishedAt 복합 인덱스로 채널당 읽기 수를 제한한다.
  for (let i = 0; i < sources.length; i += 6) {
    const chunk = sources.slice(i, i + 6);
    const snapshots = await Promise.all(chunk.map((source) =>
      db.collection("items").where("sourceId", "==", source.id)
        .where("publishedAt", ">=", since).orderBy("publishedAt", "desc").limit(25).get(),
    ));
    snapshots.forEach((snapshot, index) => {
      const source = chunk[index];
      const channel: Source = { id: source.id, name: String(source.data()?.["name"] ?? source.id), type: "youtube" };
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const publishedAt = toIso(data?.["publishedAt"]);
        if (!data || !publishedAt || data["kind"] !== "video") continue;
        if (!["live", "title_changed"].includes(String(data["status"]))) continue;
        if (data["eventId"] != null && !published.has(String(data["eventId"]))) continue;
        if (Date.parse(publishedAt) > now.getTime() + 3_600_000) continue;
        const title = String(data["title"] ?? "");
        const url = String(data["url"] ?? "");
        if (!isRecentLeeVideo(title, url)) continue;
        videos.push({ channel, item: { id: doc.id, sourceId: channel.id, title, url, publishedAt } });
      }
    });
  }
  videos.sort((a, b) => Date.parse(b.item.publishedAt) - Date.parse(a.item.publishedAt) || a.item.id.localeCompare(b.item.id));
  return { videos, available: true, checkedAt };
}
