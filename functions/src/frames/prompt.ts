/**
 * 프레임 분류 프롬프트.
 *
 * 이 파일이 제품에서 가장 논쟁적인 산출물이다. `/method` 에 공개한 규칙과
 * 여기 적힌 규칙이 어긋나면 그 순간 신뢰가 무너지므로, 문구를 고칠 때는
 * src/app/method/page.tsx 도 함께 고친다.
 *
 * 핵심 제약 세 가지
 *  1. 판단 근거는 제목뿐이다. 본문을 넣지 않는다(저작권·비용·환각).
 *  2. 라벨은 서술형으로 쓴다. '왜곡', '악의적' 같은 평가어를 쓰지 않는다.
 *  3. 억지로 배정하지 않는다. 안 맞으면 미배정으로 남긴다.
 */

export interface FrameCandidate {
  itemId: string;
  sourceName: string;
  title: string;
  /** KST "HH:mm" */
  publishedAt: string;
}

export interface FrameDraftInput {
  eventTitle: string;
  eventSummary: string;
  /** KST "HH:mm" */
  occurredAt: string;
  candidates: FrameCandidate[];
}

export const SYSTEM_PROMPT = `당신은 한국 언론의 기사 제목을 분류하는 편집 보조입니다.

하나의 사건에 대해 여러 매체가 붙인 제목을 읽고, 제목이 무엇을 앞세우고 있는지에 따라 묶습니다. 이 결과는 사람이 검수한 뒤에야 공개되며, 당신의 출력은 초안입니다.

## 반드시 지킬 것

1. 판단 근거는 제공된 제목뿐입니다. 기사 본문을 상상하지 마세요. 제목에 없는 내용을 근거로 삼지 마세요.
2. 묶음 이름(label)은 무엇을 앞세웠는지 서술합니다.
   - 좋은 예: "'지원 확대'를 앞세움", "'재원·실효성 우려'를 앞세움", "'발표 절차·시점'을 앞세움"
   - 나쁜 예: "왜곡 보도", "악의적 프레이밍", "친정부 성향", "비판적 매체"
3. 매체를 평가하지 마세요. 매체의 성향·의도·신뢰도를 추측하거나 언급하지 마세요. 당신이 보는 것은 이 사건에 붙은 제목 하나뿐이며, 그것으로 매체를 규정할 수 없습니다.
4. 묶음은 2~4개입니다. 3개를 넘기려면 그만한 차이가 실제로 있어야 합니다.
5. 어느 묶음에도 자연스럽게 들어가지 않는 제목은 unassignedItemIds 에 남기세요. 억지로 배정하지 마세요. 사건과 무관해 보이는 제목도 여기에 둡니다.
6. 제목 원문을 바꾸거나 요약하지 마세요. 당신은 분류만 합니다.
7. 모든 itemId 는 제공된 목록에 있는 것이어야 하고, 한 번씩만 등장해야 합니다.

## 묶는 기준

제목의 주어와 술어가 무엇을 향하는지를 봅니다.

- 무엇을 성과·변화로 제시하는가
- 무엇을 우려·한계로 제시하는가
- 정책 내용이 아니라 절차·시점·정치적 맥락을 앞세우는가
- 특정 인물의 발언을 앞세우는가
- 사실 전달에 그치는가

이 목록은 예시이며, 실제 제목에 맞는 축을 직접 찾으세요. 사건마다 축은 다릅니다.

## note 필드

각 묶음이 어떤 기준으로 묶였는지 한 문장으로 씁니다. 독자가 "왜 이 제목들이 한 묶음인가"를 이해할 수 있어야 합니다. 평가나 해석이 아니라 기준의 서술입니다.`;

export function buildUserPrompt(input: FrameDraftInput): string {
  const lines = input.candidates.map(
    (c) => `${c.itemId} | ${c.sourceName} | ${c.publishedAt} | ${c.title}`,
  );

  return `## 사건

제목: ${input.eventTitle}
요약: ${input.eventSummary}
발생 시각: ${input.occurredAt} (KST)

## 이 사건에 대해 확인된 제목 ${input.candidates.length}건

형식: itemId | 매체명 | 게시시각 | 제목

${lines.join("\n")}

위 제목들을 묶어 주세요.`;
}

/**
 * 구조화 출력 스키마.
 * 지원되지 않는 제약(minLength, minItems 등)은 쓰지 않는다.
 */
export const FRAME_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["frames", "unassignedItemIds"],
  properties: {
    frames: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "note", "itemIds"],
        properties: {
          key: {
            type: "string",
            description: "영문 소문자 슬러그. 예: expand, concern, process",
          },
          label: {
            type: "string",
            description: "서술형 묶음 이름. 예: '재원·실효성 우려'를 앞세움",
          },
          note: {
            type: "string",
            description: "이 묶음의 기준을 설명하는 한 문장",
          },
          itemIds: {
            type: "array",
            items: { type: "string" },
            description: "이 묶음에 속한 itemId 목록",
          },
        },
      },
    },
    unassignedItemIds: {
      type: "array",
      items: { type: "string" },
      description: "어느 묶음에도 넣지 않은 itemId 목록",
    },
  },
} as const;
