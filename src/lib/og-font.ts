import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * satori(ImageResponse)는 실제 폰트 바이트를 요구하고 .ttc 컬렉션은 읽지 못한다.
 * 그래서 한글 카드를 그리려면 .ttf/.otf 파일이 반드시 있어야 한다.
 *
 * 배포 빌드는 CI(리눅스)에서 돌기 때문에 폰트를 저장소에 넣어야 한다.
 * assets/fonts/ 가 비어 있으면 macOS 시스템 폰트로 폴백하는데,
 * 이건 로컬에서 레이아웃을 확인하기 위한 임시 경로일 뿐이다.
 */

const VENDORED_DIR = join(process.cwd(), "assets/fonts");

// 로컬 폴백. Apple 시스템 폰트라 재배포 불가 — CI 에는 없다.
const MACOS_FALLBACK = "/System/Library/Fonts/Supplemental/AppleGothic.ttf";

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

async function readIfExists(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

const toArrayBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

/**
 * Regular/Bold 두 벌을 돌려준다.
 * 벤더링된 폰트가 없으면 시스템 폴백 하나를 두 weight 에 모두 물린다
 * (굵기 대비는 사라지지만 레이아웃 확인은 가능).
 */
export async function loadCardFonts(): Promise<LoadedFont[]> {
  const regular =
    (await readIfExists(join(VENDORED_DIR, "Pretendard-Regular.otf"))) ??
    (await readIfExists(join(VENDORED_DIR, "NotoSansKR-Regular.ttf")));
  const bold =
    (await readIfExists(join(VENDORED_DIR, "Pretendard-Bold.otf"))) ??
    (await readIfExists(join(VENDORED_DIR, "NotoSansKR-Bold.ttf")));

  if (regular && bold) {
    return [
      { name: "Card", data: toArrayBuffer(regular), weight: 400, style: "normal" },
      { name: "Card", data: toArrayBuffer(bold), weight: 700, style: "normal" },
    ];
  }

  const fallback = await readIfExists(MACOS_FALLBACK);
  if (!fallback) {
    throw new Error(
      "한글 폰트를 찾지 못했습니다. assets/fonts/ 에 Pretendard 또는 Noto Sans KR " +
        "(Regular/Bold, .otf 또는 .ttf)을 넣어 주세요. 없으면 카드가 전부 두부(□)로 렌더됩니다.",
    );
  }

  const data = toArrayBuffer(fallback);
  return [
    { name: "Card", data, weight: 400, style: "normal" },
    { name: "Card", data, weight: 700, style: "normal" },
  ];
}
