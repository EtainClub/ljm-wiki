import { ImageResponse } from "next/og";

/**
 * 앱 아이콘. 사건 페이지의 비율 바를 세로로 쌓은 모양이다.
 * 색 세 개는 프레임, 마지막 회색은 '보도하지 않음'을 뜻한다.
 *
 * 글자를 넣지 않는다 — 48px 로 줄었을 때 한글은 뭉개지고, 폰트 로딩도 필요 없어진다.
 */

const BARS = [
  { color: "#818cf8", width: 88 },
  { color: "#fbbf24", width: 66 },
  { color: "#2dd4bf", width: 44 },
  { color: "#52525b", width: 74 },
] as const;

/**
 * @param size 정사각 픽셀 크기
 * @param maskable 마스커블 아이콘은 바깥 20% 가 잘릴 수 있어 안쪽으로 더 밀어 넣는다
 */
export function buildAppIcon(size: number, maskable = false) {
  // 32px 짜리 탭 아이콘은 여백을 그대로 두면 막대가 1~2px 이 되어 뭉갠다.
  // 작은 크기에서는 여백을 줄이고 막대를 두껍게 잡아 네 개가 세어지게 한다.
  const tiny = size <= 48;
  const pad = maskable ? size * 0.26 : size * (tiny ? 0.09 : 0.17);
  const barHeight = size * (tiny ? 0.15 : 0.1);
  const gap = size * (tiny ? 0.08 : 0.062);
  const inner = size - pad * 2;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: "#09090b",
        padding: pad,
      }}
    >
      {BARS.map((bar, i) => (
        <div
          key={bar.color}
          style={{
            width: (inner * bar.width) / 100,
            height: barHeight,
            borderRadius: barHeight / 2,
            backgroundColor: bar.color,
            marginBottom: i === BARS.length - 1 ? 0 : gap,
          }}
        />
      ))}
    </div>
  );
}

/** 아이콘 라우트에서 그대로 반환한다. 빌드 시 PNG 파일로 떨어진다. */
export function iconResponse(size: number, maskable = false) {
  return new ImageResponse(buildAppIcon(size, maskable), {
    width: size,
    height: size,
  });
}
