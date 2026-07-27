import { BRAND } from "@/lib/brand";
import type { EventBundle } from "@/lib/event-types";
import { formatLongDate, formatTime } from "@/lib/kst";

/**
 * 카톡·커뮤니티에 이미지로 붙이는 세로형 공유 카드 (1080×1350).
 *
 * 설계 의도
 *  - 카드에 제목이 실제로 실려야 한다. 카운트만 있으면 "같은 사건, 다른 제목"이
 *    무슨 뜻인지 카드만 보고는 알 수 없다. 프레임마다 대표 제목 한 줄을 넣는다.
 *  - 마지막에 남는 인상은 '보도하지 않음' 숫자 하나다.
 *  - 색은 구분용일 뿐 평가가 아니다. 빨강·초록을 쓰지 않는다.
 *
 * satori 제약: flexbox 만 지원(grid 불가), 자식이 둘 이상인 요소는 display:flex 명시.
 */

export const CARD_SIZE = { width: 1080, height: 1350 } as const;
export const OG_SIZE = { width: 1200, height: 630 } as const;

const ACCENTS = ["#818cf8", "#fbbf24", "#2dd4bf"] as const;

/** 카드 폭에서 두 줄을 넘지 않도록 자른다. satori 에는 말줄임 처리가 없다. */
function clamp(text: string, max = 42): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildShareCard(bundle: EventBundle, siteLabel: string) {
  const { event, items } = bundle;
  const entries = Object.values(event.coverage);
  const total = entries.length;
  const silent = entries.filter((c) => c.status === "none").length;
  const checkedAt = entries[0]?.checkedAt ?? event.publishedAt;

  return (
    <div
      style={{
        width: CARD_SIZE.width,
        height: CARD_SIZE.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#09090b",
        color: "#fafafa",
        padding: 68,
        fontFamily: "Card",
      }}
    >
      <div style={{ display: "flex", fontSize: 29, color: "#a1a1aa" }}>
        {BRAND.name}
      </div>

      <div
        style={{ display: "flex", fontSize: 31, color: "#a1a1aa", marginTop: 52 }}
      >
        {formatLongDate(event.occurredAt)}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.24,
          marginTop: 14,
        }}
      >
        {event.title}
      </div>

      {/* 비율 바 */}
      <div
        style={{
          display: "flex",
          height: 20,
          marginTop: 46,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: "#3f3f46",
        }}
      >
        {event.frames.map((frame, i) => (
          <div
            key={frame.key}
            style={{
              width: `${(frame.itemIds.length / total) * 100}%`,
              backgroundColor: ACCENTS[i % ACCENTS.length],
            }}
          />
        ))}
      </div>

      {/* 프레임별 대표 제목 — 카드의 본문 */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
        {event.frames.map((frame, i) => {
          const lead = items[frame.itemIds[0]];
          return (
            <div
              key={frame.key}
              style={{ display: "flex", flexDirection: "column", marginBottom: 34 }}
            >
              <div style={{ display: "flex", alignItems: "center", fontSize: 30 }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: ACCENTS[i % ACCENTS.length],
                    marginRight: 16,
                  }}
                />
                <div style={{ display: "flex", color: "#a1a1aa" }}>
                  {frame.label}
                </div>
                <div
                  style={{ display: "flex", fontWeight: 700, marginLeft: 14 }}
                >
                  {frame.itemIds.length}
                </div>
              </div>
              {lead && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 37,
                    lineHeight: 1.36,
                    color: "#e4e4e7",
                    marginTop: 10,
                    marginLeft: 32,
                  }}
                >
                  {clamp(lead.title)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 마지막 인상 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
          border: "3px dashed #52525b",
          borderRadius: 26,
          paddingLeft: 44,
          paddingRight: 44,
          paddingTop: 26,
          paddingBottom: 26,
        }}
      >
        <div style={{ display: "flex", fontSize: 40, color: "#d4d4d8" }}>
          보도하지 않음
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div
            style={{
              display: "flex",
              fontSize: 128,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {silent}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 44,
              color: "#71717a",
              marginLeft: 14,
              paddingBottom: 8,
            }}
          >
            / {total}곳
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 27,
          color: "#71717a",
          marginTop: 30,
        }}
      >
        <div style={{ display: "flex" }}>
          {formatTime(checkedAt)} 기준 · 제목은 원문 인용
        </div>
        <div style={{ display: "flex" }}>{siteLabel}</div>
      </div>
    </div>
  );
}

/**
 * 링크 미리보기용 가로형 이미지 (1200×630).
 * 세로 카드와 달리 대화방이 아니라 링크 카드 안에서 작게 보이므로, 제목과
 * '보도하지 않음' 숫자만 남기고 나머지는 뺀다.
 */
export function buildOgCard(bundle: EventBundle) {
  const { event } = bundle;
  const entries = Object.values(event.coverage);
  const total = entries.length;
  const silent = entries.filter((c) => c.status === "none").length;

  return (
    <div
      style={{
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#09090b",
        color: "#fafafa",
        padding: 64,
        fontFamily: "Card",
      }}
    >
      <div style={{ display: "flex", fontSize: 26, color: "#a1a1aa" }}>
        {BRAND.name} · {formatLongDate(event.occurredAt)}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.24,
          marginTop: 26,
        }}
      >
        {event.title}
      </div>

      <div
        style={{
          display: "flex",
          height: 18,
          marginTop: "auto",
          borderRadius: 9,
          overflow: "hidden",
          backgroundColor: "#3f3f46",
        }}
      >
        {event.frames.map((frame, i) => (
          <div
            key={frame.key}
            style={{
              width: `${(frame.itemIds.length / total) * 100}%`,
              backgroundColor: ACCENTS[i % ACCENTS.length],
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginTop: 34,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              color: "#d4d4d8",
              paddingBottom: 12,
            }}
          >
            보도하지 않음
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 86,
              fontWeight: 700,
              lineHeight: 1,
              marginLeft: 20,
            }}
          >
            {silent}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              color: "#71717a",
              marginLeft: 10,
              paddingBottom: 12,
            }}
          >
            / {total}곳
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#71717a" }}>
          제목은 원문 인용
        </div>
      </div>
    </div>
  );
}
