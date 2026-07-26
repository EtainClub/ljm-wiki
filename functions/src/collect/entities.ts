/**
 * HTML 엔티티 디코딩.
 *
 * 왜 필요한가 — 실제 피드에서 확인된 두 가지 때문이다.
 *
 *  1. CDATA 안의 엔티티는 XML 파서가 풀지 않는다. 머니투데이 제목이
 *     `<![CDATA[ &quot;뭔가 잘못됐다&quot; ]]>` 로 온다. 파서를 통과해도
 *     `&quot;` 가 그대로 남으므로 여기서 한 번 더 푼다.
 *
 *  2. 앰퍼샌드를 빠뜨린 채 내보내는 곳이 있다. 프레시안은 `&hellip;` 대신
 *     `hellip;` 를 보낸다. 매체 사이트에는 `…` 로 보이므로 이건 전송 과정의
 *     사고이지 매체가 단 제목이 아니다. 복원하는 편이 인용에 더 충실하다.
 *     다만 오탐을 피하려고 활자 기호 몇 개로만 제한한다.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  middot: "·",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
};

/** & 없이 날아오는 사고를 복원할 대상. 일반 단어와 겹치지 않는 것만 넣는다. */
const BARE_RECOVERABLE = [
  "hellip",
  "middot",
  "ldquo",
  "rdquo",
  "lsquo",
  "rsquo",
  "mdash",
  "ndash",
  "nbsp",
] as const;

const BARE_RE = new RegExp(`(^|[^&\\w])(${BARE_RECOVERABLE.join("|")});`, "g");

export function decodeEntities(input: string): string {
  let out = input;

  // 이중 인코딩(&amp;quot;)을 위해 두 번 돈다.
  for (let pass = 0; pass < 2; pass++) {
    out = out.replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    );
    out = out.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    );
    out = out.replace(/&([a-z]+);/gi, (match, name: string) => {
      const value = NAMED[name.toLowerCase()];
      return value ?? match;
    });
  }

  // 앰퍼샌드가 유실된 경우 복원
  out = out.replace(BARE_RE, (_, prefix: string, name: string) => prefix + (NAMED[name] ?? ""));

  return out;
}
