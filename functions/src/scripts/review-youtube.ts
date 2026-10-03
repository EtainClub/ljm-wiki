/** 채널 등록 전 실제 ID와 최근 관련 원제를 읽기 전용으로 확인한다. */
import { loadLocalEnv, requireEnv } from "../env";
import { resolveChannelReference, fetchUploads } from "../collect/youtube";
import { db, SOURCES } from "../firebase";
import type { SourceDoc } from "../domain";

loadLocalEnv();

async function main(): Promise<void> {
  const references = process.argv.slice(2);
  if (references.length === 0) {
    const snap = await db.collection(SOURCES).where("type", "==", "youtube").get();
    const sources = snap.docs.map((doc) => doc.data() as SourceDoc)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    console.log(JSON.stringify(sources.map(({ id, name, channelId, active }) => ({ id, name, channelId, active })), null, 2));
    return;
  }
  const key = requireEnv("YOUTUBE_API_KEY");
  for (const reference of references) {
    try {
      const channel = await resolveChannelReference(reference, key);
      const uploads = await fetchUploads("yt_" + channel.channelId, channel.uploadsPlaylistId, key, 50);
      const related = uploads.filter((item) => /이재명|이\s*대통령|[李李]|대통령/u.test(item.title));
      console.log(JSON.stringify({
        reference, ...channel,
        checkedAt: new Date().toISOString(),
        recentCount: uploads.length,
        relatedCount: related.length,
        examples: related.slice(0, 6).map(({ title, url, publishedAt }) => ({ title, url, publishedAt: publishedAt.toISOString() })),
      }));
    } catch (error) {
      console.log(JSON.stringify({ reference, error: error instanceof Error ? error.message : String(error) }));
    }
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
