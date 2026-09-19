/**
 * 관찰할 YouTube 채널을 명시적으로 등록한다.
 *
 *   YOUTUBE_API_KEY=... npm --prefix functions run youtube:add -- "채널명" "@핸들 또는 UC..." [표시순서]
 *
 * 검색으로 채널을 발견하거나, 정치 성향을 추론해서 등록하지 않는다. 운영자가
 * @핸들·채널 URL·채널 ID를 YouTube API로 확인한 뒤 Firestore sources에 넣는다.
 */

import { requireEnv, loadLocalEnv } from "../env";
import { resolveChannelReference } from "../collect/youtube";
import type { SourceDoc } from "../domain";
import { SOURCES, db } from "../firebase";

loadLocalEnv();

function usage(): never {
  throw new Error(
    '사용법: youtube:add -- "표시할 채널명" "@핸들, 채널 URL, 또는 UC 채널 ID" [표시순서=100]',
  );
}

async function main(): Promise<void> {
  const [nameRaw, channelReferenceRaw, displayOrderRaw] = process.argv.slice(2);
  const name = nameRaw?.trim();
  const channelReference = channelReferenceRaw?.trim();
  if (!name || !channelReference) usage();

  const displayOrder = Number(displayOrderRaw ?? "100");
  if (!Number.isInteger(displayOrder) || displayOrder < 1) {
    throw new Error("표시순서는 1 이상의 정수여야 합니다.");
  }

  const apiKey = requireEnv("YOUTUBE_API_KEY");
  const { channelId, uploadsPlaylistId, title } = await resolveChannelReference(
    channelReference,
    apiKey,
  );
  const id = `yt_${channelId}`;
  const ref = db.collection(SOURCES).doc(id);
  const existing = await ref.get();
  if (existing.exists) {
    const source = existing.data() as SourceDoc;
    if (source.type !== "youtube" || source.channelId !== channelId) {
      throw new Error(`다른 출처가 같은 ID를 쓰고 있습니다: ${id}`);
    }
  }

  const source: SourceDoc = {
    id,
    name,
    type: "youtube",
    active: existing.exists ? ((existing.data() as SourceDoc).active ?? true) : true,
    displayOrder,
    channelId,
    uploadsPlaylistId,
  };
  await ref.set(source, { merge: true });

  console.log(`등록 완료: ${name} (${title})`);
  console.log(`채널 ID: ${channelId}\nuploads playlist: ${uploadsPlaylistId}`);
  console.log("다음 수집부터 제목·URL·게시시각만 후보 풀에 들어갑니다.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
