import { XMLParser } from "fast-xml-parser";
import type { CollectedItem } from "../domain";
import { decodeEntities } from "./entities";

/**
 * RSS 2.0 / Atom 파싱.
 *
 * 정규식으로 긁지 않는다 — CDATA, 중첩 태그, 엔티티 때문에 조용히 틀린 제목을
 * 만들어 낸다. 이 제품에서 제목이 틀리는 것은 치명적이다.
 *
 * 저장 대상은 제목·링크·게시시각뿐이다. 본문(description/content)은 읽지도
 * 저장하지도 않는다 (저작권).
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: true,
  // 제목이 <b> 같은 걸 품고 있어도 텍스트만 남긴다
  parseTagValue: false,
});

const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

/**
 * 남아 있는 HTML 태그를 걷고 엔티티를 푼 뒤 공백을 정리한다.
 * 낱말은 건드리지 않는다 — 요약·재서술은 하지 않는다.
 */
function cleanTitle(raw: string): string {
  return decodeEntities(raw)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function linkOf(entry: Record<string, unknown>): string {
  const link = entry["link"];
  if (typeof link === "string" && link) return link;

  // Atom: <link rel="alternate" href="..."/>
  for (const l of asArray(link as Record<string, unknown> | Record<string, unknown>[])) {
    if (!l || typeof l !== "object") continue;
    const rel = l["@_rel"];
    const href = l["@_href"];
    if (typeof href === "string" && (rel === undefined || rel === "alternate")) return href;
  }

  const text = textOf(link);
  if (text) return text;

  const guid = entry["guid"];
  const guidText = textOf(guid);
  return /^https?:\/\//.test(guidText) ? guidText : "";
}

function dateOf(entry: Record<string, unknown>): Date | null {
  for (const key of ["pubDate", "published", "updated", "dc:date", "date"]) {
    const raw = textOf(entry[key]);
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export class FeedParseError extends Error {}

/**
 * @param sourceId 결과에 붙일 매체 id
 * @param xml fetchFeed 로 받은 본문
 */
export function parseFeed(sourceId: string, xml: string): CollectedItem[] {
  // 폐지된 피드가 HTML 안내문을 200 으로 주는 경우가 있다 (중앙일보).
  // XML 로 파싱은 되지만 항목이 0 이므로 여기서 명확히 실패시킨다.
  if (/^\s*<!DOCTYPE html/i.test(xml) || /<html[\s>]/i.test(xml.slice(0, 500))) {
    throw new FeedParseError("HTML 응답 — 피드가 아님(폐지되었을 수 있음)");
  }

  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch (e) {
    throw new FeedParseError(`XML 파싱 실패: ${e instanceof Error ? e.message : e}`);
  }

  const rss = doc["rss"] as Record<string, unknown> | undefined;
  const channel = rss?.["channel"] as Record<string, unknown> | undefined;
  const feed = doc["feed"] as Record<string, unknown> | undefined;

  const entries = [
    ...asArray(channel?.["item"] as Record<string, unknown>[] | undefined),
    ...asArray(feed?.["entry"] as Record<string, unknown>[] | undefined),
    // RDF (RSS 1.0)
    ...asArray(
      (doc["rdf:RDF"] as Record<string, unknown> | undefined)?.["item"] as
        | Record<string, unknown>[]
        | undefined,
    ),
  ];

  if (entries.length === 0) throw new FeedParseError("항목이 없음");

  const items: CollectedItem[] = [];
  const dropped = { title: 0, url: 0, date: 0 };

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const title = cleanTitle(textOf(entry["title"]));
    // 링크에도 엔티티가 들어온다 (프레시안은 &amp;amp; 로 이중 인코딩해 보낸다).
    const url = decodeEntities(linkOf(entry)).trim();
    const publishedAt = dateOf(entry);
    // 셋 중 하나라도 없으면 버린다. 링크 없는 제목은 렌더할 수 없고,
    // 시각 없는 항목은 보도 지연을 잴 수 없다.
    if (!title || !url || !publishedAt) {
      if (!title) dropped.title++;
      else if (!url) dropped.url++;
      else dropped.date++;
      continue;
    }
    items.push({ sourceId, title, url, publishedAt, kind: "article" });
  }

  if (items.length === 0) {
    // 무엇이 없어서 다 버렸는지 알려 준다. 한겨레처럼 pubDate 자체를 안 주는
    // 피드가 있어서, 원인 없이 "항목 없음" 만 보면 주소를 의심하게 된다.
    throw new FeedParseError(
      `항목 ${entries.length}개를 모두 버림 (제목없음 ${dropped.title} · 링크없음 ${dropped.url} · 시각없음 ${dropped.date})`,
    );
  }
  return items;
}
