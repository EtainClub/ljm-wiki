import type { EventBundle, Item, Source } from "./event-types";

export interface VideoRecord {
  item: Item;
  channel: Source;
  eventSlug: string;
  eventTitle: string;
  eventSummary: string;
  frameLabel: string;
  isSample: boolean;
}

/** 관찰 가능한 제목 표현만 분류한다. 영상 장르나 정치적 태도를 추정하지 않는다. */
export function titleForms(title: string): string[] {
  const forms: string[] = [];
  if (/[?？]/u.test(title)) forms.push("질문형 제목");
  if (/["“”‘’「」]/u.test(title)) forms.push("인용 표현");
  if (/(?:\bLIVE\b|라이브|생중계|현장중계)/iu.test(title)) forms.push("라이브·중계 표기");
  if (/(?:#shorts\b|쇼츠)/iu.test(title)) forms.push("쇼츠 표기");
  return forms.length > 0 ? forms : ["일반 제목"];
}

/** 승인·발행된 사건에 연결된 영상만 공개한다. 수집 후보와 초안은 포함하지 않는다. */
export function getVideoRecords(bundles: EventBundle[]): VideoRecord[] {
  const records: VideoRecord[] = [];
  const seen = new Set<string>();
  for (const { event, sources, items } of bundles) {
    for (const frame of event.frames) {
      for (const id of frame.itemIds) {
        const item = items[id];
        const channel = item && sources[item.sourceId];
        if (!item || !channel || channel.type !== "youtube" || !item.url) continue;
        const key = event.slug + ":" + id;
        if (seen.has(key)) continue;
        seen.add(key);
        records.push({
          item, channel,
          eventSlug: event.slug,
          eventTitle: event.title,
          eventSummary: event.summary,
          frameLabel: frame.label,
          isSample: event.isSample === true,
        });
      }
    }
  }
  return records.sort((a, b) =>
    Date.parse(b.item.publishedAt) - Date.parse(a.item.publishedAt) ||
    a.item.id.localeCompare(b.item.id),
  );
}

export function filterVideoRecords(
  records: VideoRecord[],
  filters: { channel?: string; event?: string; query?: string; form?: string },
): VideoRecord[] {
  const query = filters.query?.trim().toLocaleLowerCase("ko") ?? "";
  return records.filter((record) =>
    (!filters.channel || record.channel.id === filters.channel) &&
    (!filters.event || record.eventSlug === filters.event) &&
    (!filters.form || titleForms(record.item.title).includes(filters.form)) &&
    (!query || [record.item.title, record.channel.name, record.eventTitle]
      .some((text) => text.toLocaleLowerCase("ko").includes(query))),
  );
}
