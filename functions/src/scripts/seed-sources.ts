/**
 * 매체 목록을 Firestore 에 반영한다.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=<서비스계정.json> \
 *   GCLOUD_PROJECT=<프로젝트id> \
 *   [YOUTUBE_API_KEY=<키>] \
 *   npm --prefix functions run seed
 *
 * 기존 문서의 health 와 운영자가 손댄 active/displayOrder 는 덮어쓰지 않는다.
 * 목록 변경은 이력이 남아야 하므로 삭제는 하지 않고 active:false 로 두는 것을 권한다.
 */

import { SOURCES, db } from "../firebase";
import type { SourceDoc } from "../domain";
import { ALL_SOURCES } from "../sources.seed";
import { resolveUploadsPlaylist } from "../collect/youtube";

async function main(): Promise<void> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  let created = 0;
  let updated = 0;

  for (const source of ALL_SOURCES) {
    const ref = db.collection(SOURCES).doc(source.id);
    const snap = await ref.get();

    const next: SourceDoc = { ...source };

    // uploadsPlaylistId 는 채널당 1회만 조회한다 (channels.list = 1 unit).
    if (next.type === "youtube" && next.channelId && !next.uploadsPlaylistId) {
      const cached = snap.exists
        ? (snap.data() as SourceDoc).uploadsPlaylistId
        : undefined;
      if (cached) {
        next.uploadsPlaylistId = cached;
      } else if (apiKey) {
        const { uploadsPlaylistId } = await resolveUploadsPlaylist(next.channelId, apiKey);
        next.uploadsPlaylistId = uploadsPlaylistId;
        console.log(`  ${next.id}: uploads=${uploadsPlaylistId}`);
      } else {
        console.warn(`  ${next.id}: YOUTUBE_API_KEY 없음 — uploadsPlaylistId 미해결`);
      }
    }

    if (snap.exists) {
      // 운영자가 콘솔에서 바꿨을 수 있는 값은 유지한다.
      const existing = snap.data() as SourceDoc;
      next.active = existing.active ?? next.active;
      next.displayOrder = existing.displayOrder ?? next.displayOrder;
      if (existing.health) next.health = existing.health;
      updated++;
    } else {
      created++;
    }

    await ref.set(next, { merge: true });
  }

  const rss = ALL_SOURCES.filter((s) => s.strategy === "rss").length;
  const naver = ALL_SOURCES.filter((s) => s.strategy === "naver").length;
  const yt = ALL_SOURCES.filter((s) => s.type === "youtube").length;

  console.log(
    `\n반영 완료 — 신규 ${created} · 갱신 ${updated}\n` +
      `RSS ${rss}곳 · 네이버 ${naver}곳 · 유튜브 ${yt}곳`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
