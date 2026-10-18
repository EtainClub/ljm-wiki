import { Timestamp } from "firebase-admin/firestore";
import { EVENTS, TONE_CORRECTIONS, db } from "../firebase";
import type { EventDoc, ToneCorrectionDoc, ToneEntry, ToneKey } from "../domain";
import { getEvent, updateEvent } from "./events";

/**
 * 보도 태도 분류.
 *
 * 제목만으로는 비판인지 비난인지 가리기 어렵다. 그래서 큐레이터(에이전트)가 제목과
 * 기사 리드를 읽고 항목마다 유형과 근거 한 줄을 남긴다. 리드·본문은 저장하지 않는다.
 *
 * 공개 경로는 프레임과 같다 — 초안 사건이면 사건 문서에 쓰고 ready 를 다시 받는다.
 * 발행 사건이면 공개 데이터를 건드리지 않고 toneCorrections 에 묶어 두었다가, 승인 PR
 * 병합 뒤 publish workflow 가 적용한다.
 */

export const TONE_KEYS: readonly ToneKey[] = [
  "support",
  "report",
  "critique",
  "allegation",
  "attack",
  "other",
];

export const TONE_LABELS: Record<ToneKey, string> = {
  support: "지지·호평",
  report: "사실 전달",
  critique: "정책 비판",
  allegation: "의혹 제기",
  attack: "비난·조롱",
  other: "기타",
};

/** 근거는 한 줄이다. 길어지면 본문 요약이 되어 저장하지 않기로 한 것을 저장하게 된다. */
const MAX_BASIS = 200;

export interface ToneInput {
  /** 항목 id. 앞 8자리만 줘도 된다. */
  item: string;
  tone: string;
  basis: string;
}

const isToneKey = (value: string): value is ToneKey =>
  (TONE_KEYS as readonly string[]).includes(value);

/** 화면에 나가는 항목은 프레임에 든 것뿐이다. 분류 대상도 그만큼이다. */
export function framedItemIds(event: EventDoc): string[] {
  return [...new Set(event.frames.flatMap((frame) => frame.itemIds))];
}

export function missingTones(event: EventDoc, tones: Record<string, ToneEntry> = {}): string[] {
  return framedItemIds(event).filter((id) => !tones[id]);
}

function resolveEntries(event: EventDoc, inputs: ToneInput[]): Record<string, ToneEntry> {
  const framed = framedItemIds(event);
  const now = Timestamp.now();
  const entries: Record<string, ToneEntry> = {};
  for (const input of inputs) {
    const matches = framed.filter((id) => id.startsWith(input.item));
    if (matches.length === 0) throw new Error(`이 사건 프레임에 없는 항목입니다: ${input.item}`);
    if (matches.length > 1) throw new Error(`앞자리가 겹칩니다: ${input.item} (${matches.length}건)`);
    if (!isToneKey(input.tone)) {
      throw new Error(`알 수 없는 태도입니다: ${input.tone} (${TONE_KEYS.join(" | ")})`);
    }
    const basis = input.basis.trim();
    if (!basis) throw new Error(`근거가 비어 있습니다: ${input.item}`);
    if (basis.length > MAX_BASIS) {
      throw new Error(`근거는 ${MAX_BASIS}자 이내 한 줄로 씁니다: ${input.item} (${basis.length}자)`);
    }
    entries[matches[0]!] = { tone: input.tone, basis, classifiedAt: now };
  }
  return entries;
}

/**
 * 분류를 기록한다. 초안이면 사건 문서에, 발행 사건이면 승인 대기 정정 계획에 쓴다.
 * 돌려주는 `missing` 은 아직 분류되지 않은 프레임 항목 수다.
 */
export async function setTones(
  slug: string,
  inputs: ToneInput[],
): Promise<{ target: "event" | "correction"; written: number; missing: number }> {
  const event = await getEvent(slug);
  const entries = resolveEntries(event, inputs);

  if (event.status !== "published") {
    const tones = { ...event.tones, ...entries };
    await updateEvent(slug, { tones });
    return { target: "event", written: inputs.length, missing: missingTones(event, tones).length };
  }

  const ref = db.collection(TONE_CORRECTIONS).doc(slug);
  const current = (await ref.get()).data() as ToneCorrectionDoc | undefined;
  const pending = current?.status === "ready" ? current.tones : {};
  const now = Timestamp.now();
  const correction: ToneCorrectionDoc = {
    eventId: slug,
    status: "ready",
    tones: { ...pending, ...entries },
    createdAt: current?.status === "ready" ? current.createdAt : now,
    updatedAt: now,
    appliedAt: null,
  };
  await ref.set(correction);
  return {
    target: "correction",
    written: inputs.length,
    missing: missingTones(event, { ...event.tones, ...correction.tones }).length,
  };
}

/** 승인 대기 중인 발행 사건 분류. queue:approval 이 표식을 만들기 전에 확인한다. */
export async function getReadyToneCorrection(slug: string): Promise<ToneCorrectionDoc> {
  const snap = await db.collection(TONE_CORRECTIONS).doc(slug).get();
  if (!snap.exists) throw new Error(`태도 분류 계획을 찾지 못했습니다: ${slug}`);
  const correction = snap.data() as ToneCorrectionDoc;
  if (correction.status !== "ready") {
    throw new Error(`승인 대기 중인 태도 분류가 아닙니다: ${slug} (${correction.status})`);
  }
  return correction;
}

/**
 * 승인 workflow 안에서만 실행한다. 공개 주소와 판(revision)은 그대로 두고 분류만
 * 더한다 — 보도 기록 자체가 바뀐 정정이 아니므로 '정정 제N판' 으로 표시하지 않는다.
 */
export async function applyToneCorrection(
  slug: string,
): Promise<{ applied: number; alreadyApplied?: true }> {
  const [event, snap] = await Promise.all([
    getEvent(slug),
    db.collection(TONE_CORRECTIONS).doc(slug).get(),
  ]);
  const current = snap.data() as ToneCorrectionDoc | undefined;
  if (current?.status === "applied") return { applied: 0, alreadyApplied: true };

  const correction = await getReadyToneCorrection(slug);
  if (event.status !== "published") throw new Error(`발행된 사건만 적용할 수 있습니다: ${slug}`);
  const framed = new Set(framedItemIds(event));
  const stale = Object.keys(correction.tones).filter((id) => !framed.has(id));
  if (stale.length > 0) {
    throw new Error(`사건 프레임에 없는 항목의 분류가 있습니다: ${stale.join(", ")}. 다시 준비하세요.`);
  }

  const now = Timestamp.now();
  const batch = db.batch();
  batch.update(db.collection(EVENTS).doc(slug), {
    tones: { ...event.tones, ...correction.tones },
    updatedAt: now,
  });
  batch.update(db.collection(TONE_CORRECTIONS).doc(slug), {
    status: "applied",
    appliedAt: now,
    updatedAt: now,
  });
  await batch.commit();
  return { applied: Object.keys(correction.tones).length };
}

/* ── 리드 읽기 ─────────────────────────────────────────────── */

const LEAD_TIMEOUT_MS = 8_000;
const MAX_LEAD = 300;

const decodeEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/** `<meta property="og:description" content="...">` — 속성 순서가 매체마다 다르다. */
function metaContent(html: string, name: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (key?.toLowerCase() !== name) continue;
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value?.trim()) return value;
  }
  return undefined;
}

/**
 * 기사·영상 페이지의 요약문(og:description)을 읽어 돌려준다. 분류할 때 화면에
 * 보여 주기만 하고 어디에도 저장하지 않는다. 대부분 매체가 리드 첫 문장을 넣는다.
 */
export async function fetchLead(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(LEAD_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; soktong-curation)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    // 일부 매체는 아직 EUC-KR 이다. UTF-8 로 읽으면 리드가 깨져 분류 근거로 쓸 수 없다.
    const bytes = new Uint8Array(await res.arrayBuffer()).slice(0, 400_000);
    const head = new TextDecoder("latin1").decode(bytes.slice(0, 4_000));
    const charset =
      /charset=([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1] ??
      /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
      "utf-8";
    let html: string;
    try {
      html = new TextDecoder(charset.toLowerCase()).decode(bytes);
    } catch {
      html = new TextDecoder("utf-8").decode(bytes);
    }
    const raw = metaContent(html, "og:description") ?? metaContent(html, "description");
    if (!raw) return null;
    const lead = decodeEntities(raw).replace(/\s+/g, " ").trim();
    return lead.length > MAX_LEAD ? `${lead.slice(0, MAX_LEAD)}…` : lead;
  } catch {
    return null;
  }
}
