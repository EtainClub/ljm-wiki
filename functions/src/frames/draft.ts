import Anthropic from "@anthropic-ai/sdk";
import {
  FRAME_DRAFT_SCHEMA,
  SYSTEM_PROMPT,
  buildUserPrompt,
  type FrameDraftInput,
} from "./prompt";

/**
 * 프레임 초안 생성.
 *
 * 결과는 status: "draft" 로만 저장한다. 자동 발행하지 않는다 —
 * 잘못된 분류가 그대로 공개되면 되돌릴 수 없다.
 */

export interface DraftedFrame {
  key: string;
  label: string;
  note: string;
  itemIds: string[];
}

export interface FrameDraftResult {
  frames: DraftedFrame[];
  unassignedItemIds: string[];
  /** 검수자에게 보여줄 경고. 비어 있지 않으면 반드시 사람이 확인해야 한다. */
  warnings: string[];
}

export class FrameDraftError extends Error {}

const MODEL = "claude-opus-5";

export async function draftFrames(
  input: FrameDraftInput,
  apiKey?: string,
): Promise<FrameDraftResult> {
  if (input.candidates.length === 0) {
    throw new FrameDraftError("분류할 제목이 없습니다.");
  }

  const client = new Anthropic(apiKey ? { apiKey } : {});

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // 분류 근거를 스스로 따져야 하는 작업이라 적응형 사고를 켠다.
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: FRAME_DRAFT_SCHEMA },
    },
    // 정치 관련 입력이라 안전 분류기가 드물게 거절할 수 있다.
    // 거절 시 서버가 대체 모델로 같은 요청을 다시 돌린다.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  if (response.stop_reason === "refusal") {
    throw new FrameDraftError(
      `모델이 요청을 거절했습니다 (${response.stop_details?.category ?? "사유 미상"}). 사람이 직접 분류해 주세요.`,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new FrameDraftError("응답이 잘렸습니다. 제목 수를 줄여 다시 시도하세요.");
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!text.trim()) throw new FrameDraftError("빈 응답을 받았습니다.");

  let parsed: { frames?: unknown; unassignedItemIds?: unknown };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch (e) {
    throw new FrameDraftError(
      `응답을 JSON 으로 읽지 못했습니다: ${e instanceof Error ? e.message : e}`,
    );
  }

  return validate(parsed, input);
}

/**
 * 모델 출력을 그대로 믿지 않는다.
 * 구조화 출력이 스키마는 보장하지만 "실재하는 itemId 인지", "중복은 없는지",
 * "빠진 항목은 없는지" 는 보장하지 않는다.
 */
function validate(
  parsed: { frames?: unknown; unassignedItemIds?: unknown },
  input: FrameDraftInput,
): FrameDraftResult {
  const known = new Set(input.candidates.map((c) => c.itemId));
  const warnings: string[] = [];

  const rawFrames = Array.isArray(parsed.frames) ? parsed.frames : [];
  const frames: DraftedFrame[] = [];
  const seen = new Set<string>();

  for (const raw of rawFrames as Array<Record<string, unknown>>) {
    const key = String(raw["key"] ?? "").trim();
    const label = String(raw["label"] ?? "").trim();
    const note = String(raw["note"] ?? "").trim();
    const ids = Array.isArray(raw["itemIds"]) ? (raw["itemIds"] as unknown[]) : [];

    if (!key || !label) {
      warnings.push("key 또는 label 이 빈 묶음이 있어 버렸습니다.");
      continue;
    }

    const itemIds: string[] = [];
    for (const id of ids.map(String)) {
      if (!known.has(id)) {
        warnings.push(`존재하지 않는 itemId 를 버렸습니다: ${id}`);
        continue;
      }
      if (seen.has(id)) {
        warnings.push(`중복 배정된 itemId 를 버렸습니다: ${id}`);
        continue;
      }
      seen.add(id);
      itemIds.push(id);
    }

    if (itemIds.length === 0) {
      warnings.push(`빈 묶음을 버렸습니다: ${label}`);
      continue;
    }
    frames.push({ key, label, note, itemIds });
  }

  // 미배정 목록은 모델 답을 믿지 않고 직접 계산한다.
  const unassignedItemIds = input.candidates
    .map((c) => c.itemId)
    .filter((id) => !seen.has(id));

  const claimed = Array.isArray(parsed.unassignedItemIds)
    ? new Set((parsed.unassignedItemIds as unknown[]).map(String))
    : new Set<string>();
  for (const id of unassignedItemIds) {
    if (!claimed.has(id)) {
      warnings.push(`모델이 언급하지 않고 빠뜨린 itemId 입니다: ${id}`);
    }
  }

  if (frames.length < 2) {
    warnings.push(`묶음이 ${frames.length}개뿐입니다. 비교가 성립하는지 확인하세요.`);
  }
  if (frames.length > 4) {
    warnings.push(`묶음이 ${frames.length}개입니다. 4개 이하로 줄이는 것을 검토하세요.`);
  }

  // 평가어가 라벨에 섞이면 /method 에 공개한 규칙을 어긴 것이다.
  const BANNED = ["왜곡", "악의", "편파", "선동", "나팔", "받아쓰기", "친정부", "반정부"];
  for (const frame of frames) {
    for (const word of BANNED) {
      if (frame.label.includes(word) || frame.note.includes(word)) {
        warnings.push(`평가어가 섞였습니다 ("${word}"): ${frame.label}`);
      }
    }
  }

  const ratio = unassignedItemIds.length / input.candidates.length;
  if (ratio > 0.3) {
    warnings.push(
      `미배정이 ${Math.round(ratio * 100)}% 입니다. 사건 범위가 넓거나 후보에 무관한 제목이 섞였을 수 있습니다.`,
    );
  }

  return { frames, unassignedItemIds, warnings };
}
