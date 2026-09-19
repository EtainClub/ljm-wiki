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

export interface ResolvedYouTubeChannel {
  channelId: string;
  uploadsPlaylistId: string;
  title: string;
}

async function call<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${API}/${path}?${qs}`);
  if (!res.ok) {
    throw new Error(`YouTube ${path} 실패: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as T;
}

async function resolveChannel(
  params: Record<string, string>,
  displayReference: string,
  apiKey: string,
): Promise<ResolvedYouTubeChannel> {
  const data = await call<ChannelsResponse>(
    "channels",
    { part: "snippet,contentDetails", ...params },
    apiKey,
  );
  const channel = data.items?.[0];
  const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads || !channel?.id) throw new Error(`채널을 찾지 못했습니다: ${displayReference}`);
  return {
    channelId: channel.id,
    uploadsPlaylistId: uploads,
    title: channel?.snippet?.title ?? channel.id,
  };
}

/** 채널 ID → uploads 플레이리스트 ID. 시드 때 1회만 부른다. */
export async function resolveUploadsPlaylist(
  channelId: string,
  apiKey: string,
): Promise<{ uploadsPlaylistId: string; title: string }> {
  const resolved = await resolveChannel({ id: channelId }, channelId, apiKey);
  return {
    uploadsPlaylistId: resolved.uploadsPlaylistId,
    title: resolved.title,
  };
}

/**
 * 사람이 복사한 @핸들, 채널 URL, 또는 UC 채널 ID를 API의 영구 채널 ID로 해석한다.
 * 등록 시 한 번만 호출하며 이후 수집은 uploads 플레이리스트만 사용한다.
 */
export async function resolveChannelReference(
  rawReference: string,
  apiKey: string,
): Promise<ResolvedYouTubeChannel> {
  const reference = rawReference.trim();
  if (/^UC[\w-]{20,}$/.test(reference)) {
    return resolveChannel({ id: reference }, reference, apiKey);
  }

  let handle = reference;
  try {
    const url = new URL(reference);
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) {
      throw new Error("YouTube 주소가 아닙니다.");
    }
    const channelMatch = url.pathname.match(/^\/channel\/(UC[\w-]{20,})\/?$/);
    const channelId = channelMatch?.[1];
    if (channelId) return resolveChannel({ id: channelId }, reference, apiKey);
    const handleMatch = url.pathname.match(/^\/(@[^/]+)\/?$/);
    const urlHandle = handleMatch?.[1];
    if (!urlHandle) throw new Error("@핸들이 포함된 채널 주소여야 합니다.");
    handle = urlHandle;
  } catch (error) {
    if (reference.startsWith("http")) {
      throw new Error(
        `채널 주소를 해석하지 못했습니다: ${error instanceof Error ? error.message : reference}`,
      );
    }
  }

  if (!/^@[^\s/]+$/.test(handle)) {
    throw new Error("UC 채널 ID, @핸들, 또는 https://www.youtube.com/@핸들을 입력하세요.");
  }
  return resolveChannel({ forHandle: handle }, reference, apiKey);
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
