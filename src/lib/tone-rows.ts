import type { EventBundle, Item, Source, ToneEntry, ToneKey } from "@/lib/event-types";
import { surfaceCues } from "@/lib/tone";

export interface ToneRow {
  item: Item;
  source: Source | undefined;
  tone: ToneEntry;
  cues: string[];
  event: { slug: string; title: string; occurredAt: string };
}

/** 발행된 사건들에서 분류가 붙은 기사·영상을 한 줄씩 펼친다. framedTotal 은 분류 대상 전체 수다. */
export function toneRows(bundles: EventBundle[]): { rows: ToneRow[]; framedTotal: number } {
  const rows: ToneRow[] = [];
  let framedTotal = 0;
  for (const { event, sources, items } of bundles) {
    const framed = [...new Set(event.frames.flatMap((f) => f.itemIds))].filter((id) => items[id]);
    framedTotal += framed.length;
    const context = `${event.title} ${event.summary}`;
    for (const id of framed) {
      const tone = event.tones?.[id];
      if (!tone) continue;
      const item = items[id]!;
      rows.push({
        item,
        source: sources[item.sourceId],
        tone,
        cues: surfaceCues(item.title, tone.tone, context),
        event: { slug: event.slug, title: event.title, occurredAt: event.occurredAt },
      });
    }
  }
  return { rows, framedTotal };
}

/** 매체·채널별 분류 목록 주소. tone 을 주면 그 유형만 보인다. */
export function outletHref(sourceId: string, tone?: ToneKey): string {
  const base = `/analysis/${encodeURIComponent(sourceId)}/`;
  return tone ? `${base}?tone=${tone}` : base;
}
