import { BRAND } from "@/lib/brand";

/**
 * 사이트 대표 링크 미리보기 이미지 (1200×630).
 *
 * 사건 페이지는 저마다 og.png 를 갖고 있다. 이건 홈·위키·방법 등 나머지 전부와,
 * 도메인만 붙여 공유했을 때 쓰인다. 이전에는 이 이미지가 아예 없어서
 * 링크를 공유하면 제목만 나오고 무엇에 대한 사이트인지 알 수 없었다.
 *
 * satori 제약: flex 만 쓰고, text-overflow 를 쓸 수 없으며, 한글은 폰트를
 * 바이트로 직접 넘겨야 한다 (loadCardFonts).
 */

export const SITE_OG_SIZE = { width: 1200, height: 630 } as const;

/** 앱 아이콘과 같은 기호 — 프레임 세 개와 '보도하지 않음' 회색 */
const BARS = [
  { color: "#818cf8", width: 620 },
  { color: "#fbbf24", width: 470 },
  { color: "#2dd4bf", width: 320 },
  { color: "#52525b", width: 200 },
] as const;

export function buildSiteCard() {
  return (
    <div
      style={{
        width: SITE_OG_SIZE.width,
        height: SITE_OG_SIZE.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#09090b",
        color: "#fafafa",
        padding: 72,
        fontFamily: "Card",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa" }}>
          {BRAND.tagline}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 82,
            fontWeight: 700,
            marginTop: 18,
            letterSpacing: -2,
          }}
        >
          {BRAND.name}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 32,
            lineHeight: 1.5,
            color: "#d4d4d8",
            marginTop: 26,
            maxWidth: 900,
          }}
        >
          이재명 대통령 관련 보도를 언론사별로 기록합니다. 어느 매체가 어떤 제목을
          달았는지, 그리고 어디가 다루지 않았는지.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {BARS.map((bar, i) => (
          <div
            key={bar.color}
            style={{
              width: bar.width,
              height: 18,
              borderRadius: 9,
              backgroundColor: bar.color,
              marginBottom: i === BARS.length - 1 ? 0 : 12,
            }}
          />
        ))}
      </div>
    </div>
  );
}
