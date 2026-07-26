import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ITEMS, SOURCES, db } from "../firebase";
import type { CollectResult, ItemDoc, SourceDoc } from "../domain";
import { fetchFeed } from "./fetch-feed";
import { FeedParseError, parseFeed } from "./parse-feed";
import { fetchUploads } from "./youtube";
import { itemIdFor } from "./item-id";

/**
 * 발굴(discovery) 수집.
 *
 * 매체별 최신 기사·영상을 끌어와 후보 풀(items)을 채운다. 여기서 사건을 정하지는
 * 않는다 — 사람이 items 를 보고 사건을 만든다.
 *
 * '이 매체가 이 사건을 다뤘는가'(coverage)는 다른 일이며 사건이 정해진 뒤
 * naver.findCoverage 로 확인한다.
 */

/** 너무 오래된 항목은 후보 풀을 더럽히기만 한다. */
const MAX_AGE_HOURS = 48;

export async function loadActiveSources(): Promise<SourceDoc[]> {
  const snap = await db.collection(SOURCES).where("active", "==", true).get();
  return snap.docs.map((d) => d.data() as SourceDoc);
}

/** 네트워크만 쓰고 Firestore 는 건드리지 않는다. 드라이런에서 그대로 쓴다. */
export async function collectFromSource(
  source: SourceDoc,
  youtubeApiKey?: string,
): Promise<CollectResult> {
  try {
    if (source.type === "youtube") {
      if (!source.uploadsPlaylistId) throw new Error("uploadsPlaylistId 없음 — seed 를 먼저 실행");
      if (!youtubeApiKey) throw new Error("YOUTUBE_API_KEY 없음");
      const items = await fetchUploads(source.id, source.uploadsPlaylistId, youtubeApiKey);
      return { sourceId: source.id, ok: true, items };
    }

    if (source.strategy !== "rss" || !source.rssUrl) {
      // naver 전략 매체는 발굴 대상이 아니다. 사건이 정해진 뒤 보도 여부만 확인한다.
      return { sourceId: source.id, ok: true, items: [] };
    }

    const feed = await fetchFeed(source.rssUrl);
    const items = parseFeed(source.id, feed.text);
    return { sourceId: source.id, ok: true, items };
  } catch (e) {
    const error =
      e instanceof FeedParseError
        ? `파싱: ${e.message}`
        : e instanceof Error
          ? e.message
          : String(e);
    return { sourceId: source.id, ok: false, items: [], error };
  }
}

function isFresh(publishedAt: Date, now: Date): boolean {
  const ageHours = (now.getTime() - publishedAt.getTime()) / 3_600_000;
  // 미래 시각을 주는 피드가 있다. 1시간까지는 시계 차이로 보고 허용한다.
  return ageHours <= MAX_AGE_HOURS && ageHours >= -1;
}

/** 항목을 Firestore 에 반영한다. 이미 있으면 제목 변경만 확인하고 넘어간다. */
async function persist(
  result: CollectResult,
  now: Date,
): Promise<{ added: number; changed: number; fresh: number }> {
  const nowTs = Timestamp.fromDate(now);
  let added = 0;
  let changed = 0;

  const fresh = result.items.filter((i) => isFresh(i.publishedAt, now));
  if (fresh.length === 0) return { added, changed, fresh: 0 };

  // 배치 쓰기 한도(500)를 넘지 않도록 나눠 쓴다.
  for (let i = 0; i < fresh.length; i += 400) {
    const slice = fresh.slice(i, i + 400);
    const refs = slice.map((item) => db.collection(ITEMS).doc(itemIdFor(item.url)));
    const snaps = await db.getAll(...refs);
    const batch = db.batch();

    slice.forEach((item, idx) => {
      const ref = refs[idx]!;
      const snap = snaps[idx]!;

      if (!snap.exists) {
        const doc: ItemDoc = {
          sourceId: item.sourceId,
          title: item.title,
          url: item.url,
          publishedAt: Timestamp.fromDate(item.publishedAt),
          collectedAt: nowTs,
          kind: item.kind,
          titleHistory: [{ title: item.title, observedAt: nowTs }],
          status: "live",
          lastCheckedAt: nowTs,
          eventId: null,
          frameKey: null,
        };
        batch.set(ref, doc);
        added++;
        return;
      }

      const existing = snap.data() as ItemDoc;
      if (existing.title !== item.title) {
        // 제목이 바뀌었다. 원문을 덮어쓰지 않고 이력에 덧붙인다 —
        // 우리가 언제 무엇을 봤는지가 기록의 요점이다.
        batch.update(ref, {
          title: item.title,
          status: "title_changed",
          lastCheckedAt: nowTs,
          titleHistory: FieldValue.arrayUnion({ title: item.title, observedAt: nowTs }),
        });
        changed++;
      } else {
        batch.update(ref, { lastCheckedAt: nowTs });
      }
    });

    await batch.commit();
  }

  return { added, changed, fresh: fresh.length };
}

/**
 * @param fresh 이번 회차에 받은 48시간 이내 항목 수.
 *   0 이면 fetch·파싱이 성공했어도 발굴에는 기여하지 못한 것이다.
 *   naver 전략 매체는 애초에 발굴 대상이 아니므로 세지 않는다.
 */
async function recordHealth(
  source: SourceDoc,
  result: CollectResult,
  now: Date,
  fresh: number,
): Promise<void> {
  const nowTs = Timestamp.fromDate(now);
  const ref = db.collection(SOURCES).doc(source.id);
  const discovers = source.type === "youtube" || source.strategy === "rss";

  if (result.ok) {
    await ref.update({
      "health.lastOkAt": nowTs,
      "health.consecutiveFailures": 0,
      "health.lastError": null,
      ...(discovers
        ? fresh > 0
          ? { "health.lastFreshAt": nowTs, "health.consecutiveEmpty": 0 }
          : { "health.consecutiveEmpty": FieldValue.increment(1) }
        : {}),
    });
  } else {
    await ref.update({
      "health.lastErrorAt": nowTs,
      "health.lastError": result.error ?? "unknown",
      "health.consecutiveFailures": FieldValue.increment(1),
    });
  }
}

export interface CollectSummary {
  sources: number;
  ok: number;
  failed: number;
  added: number;
  changed: number;
  failures: Array<{ sourceId: string; error: string }>;
  /** 성공했지만 신선한 항목이 0건인 발굴 매체 — 정체된 피드일 수 있다 */
  stale: string[];
}

export async function runCollection(youtubeApiKey?: string): Promise<CollectSummary> {
  const now = new Date();
  const sources = await loadActiveSources();

  const summary: CollectSummary = {
    sources: sources.length,
    ok: 0,
    failed: 0,
    added: 0,
    changed: 0,
    failures: [],
    stale: [],
  };

  // 상대 서버에 부담을 주지 않도록 6개씩 끊어서 돈다.
  for (let i = 0; i < sources.length; i += 6) {
    const chunk = sources.slice(i, i + 6);
    const results = await Promise.all(chunk.map((s) => collectFromSource(s, youtubeApiKey)));

    for (const [idx, result] of results.entries()) {
      const source = chunk[idx]!;
      let fresh = 0;
      if (result.ok) {
        summary.ok++;
        const persisted = await persist(result, now);
        summary.added += persisted.added;
        summary.changed += persisted.changed;
        fresh = persisted.fresh;

        // 200 + 유효한 RSS 인데 신선한 항목이 0건이면 정체된 피드다.
        // JTBC 뉴스속보 피드가 실제로 이 상태였다(2024-10-29 에서 멈춤).
        if (fresh === 0 && (source.type === "youtube" || source.strategy === "rss")) {
          summary.stale.push(source.id);
        }
      } else {
        summary.failed++;
        summary.failures.push({ sourceId: result.sourceId, error: result.error ?? "unknown" });
      }
      await recordHealth(source, result, now, fresh);
    }
  }

  return summary;
}
