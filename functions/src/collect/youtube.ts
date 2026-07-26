import type { CollectedItem } from "../domain";

/**
 * YouTube Data API v3.
 *
 * ⚠ search.list 를 쓰지 말 것 — 호출당 100 unit 이라 일일 쿼터 10,000 이 즉시 마른다.
 * 채널의 uploads 플레이리스트를 playlistItems.list(1 unit)로 도는 방식이면
 * 채널 50개 × 하루 4회 = 200 unit 으로 끝난다.
 *
 * uploadsPlaylistId 는 channels.list 로 최초 1회만 조회해 sources 에 캐시한다.
 */

const API = "https://www.googleapis.com/youtube/v3";

interface ChannelsResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

interface PlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      title?: string;
      publishedAt?: string;
      resourceId?: { videoId?: string };
    };
  }>;
}

async function call<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${API}/${path}?${qs}`);
  if (!res.ok) {
    throw new Error(`YouTube ${path} 실패: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as T;
}

/** 채널 ID → uploads 플레이리스트 ID. 시드 때 1회만 부른다. */
export async function resolveUploadsPlaylist(
  channelId: string,
  apiKey: string,
): Promise<{ uploadsPlaylistId: string; title: string }> {
  const data = await call<ChannelsResponse>(
    "channels",
    { part: "snippet,contentDetails", id: channelId },
    apiKey,
  );
  const channel = data.items?.[0];
  const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`채널을 찾지 못했습니다: ${channelId}`);
  return { uploadsPlaylistId: uploads, title: channel?.snippet?.title ?? channelId };
}

export async function fetchUploads(
  sourceId: string,
  uploadsPlaylistId: string,
  apiKey: string,
  maxResults = 25,
): Promise<CollectedItem[]> {
  const data = await call<PlaylistItemsResponse>(
    "playlistItems",
    { part: "snippet", playlistId: uploadsPlaylistId, maxResults: String(maxResults) },
    apiKey,
  );

  const items: CollectedItem[] = [];
  for (const entry of data.items ?? []) {
    const title = entry.snippet?.title?.trim();
    const videoId = entry.snippet?.resourceId?.videoId;
    const publishedAt = entry.snippet?.publishedAt
      ? new Date(entry.snippet.publishedAt)
      : null;

    // 비공개·삭제된 영상은 제목이 "Private video" 로 오고 videoId 가 없을 수 있다.
    if (!title || !videoId || !publishedAt || Number.isNaN(publishedAt.getTime())) continue;
    if (title === "Private video" || title === "Deleted video") continue;

    items.push({
      sourceId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt,
      kind: "video",
    });
  }
  return items;
}
