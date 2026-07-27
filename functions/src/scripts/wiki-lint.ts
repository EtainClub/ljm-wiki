/**
 * 위키 lint — wiki/schema.md 의 규칙을 기계적으로 검사한다.
 *
 *   npm --prefix functions run wiki:lint
 *
 * Firestore 를 쓰지 않는다. 파일만 본다.
 *
 * 가장 위험한 실패는 drift 다 — ingest 하면서 교차참조를 일부만 갱신하면
 * 페이지가 조용히 낡는다. 실존 인물 기록에서 낡은 페이지는 틀린 주장이
 * 그 사람 이름 아래 남아 있는 것과 같다. 그래서 검사는 기계가 한다.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WIKI = join(__dirname, "..", "..", "..", "wiki");

/** 규칙을 정의하는 문서 자신은 검사 대상이 아니다 (예시 문법이 오탐을 만든다). */
const META_PAGES = new Set(["schema", "index", "log"]);

/** 스키마가 금지한 평가어 */
const BANNED = [
  "왜곡", "편파", "악의적", "나팔수", "친명", "반명", "받아쓰기", "선동", "정치공작",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const pageId = (file: string) => relative(WIKI, file).replace(/\.md$/, "");

/**
 * `[[people/정성호]]` 또는 `[[outlets/chosun|조선일보]]`.
 *
 * 별칭은 표 안에서 필요하다 — 매체 id 가 아니라 이름이 보여야 한다.
 * 대상 이름에는 공백이 들 수 있으므로 공백으로 끊지 않는다.
 */
const WIKI_LINK = /\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g;

/** "- [[people/한동훈]] 2건" 에서 대상과 건수를 뽑는다. */
function parseMentions(text: string): Map<string, number | null> {
  const section = /## 함께 언급된 인물([\s\S]*?)(?=\n## |$)/.exec(text)?.[1] ?? "";
  const out = new Map<string, number | null>();
  for (const line of section.split("\n")) {
    const target = /\[\[(people\/[^\]|]+?)(?:\|[^\]]+)?\]\]/.exec(line)?.[1]?.trim();
    if (!target) continue;
    const count = /(\d+)\s*건/.exec(line)?.[1];
    out.set(target, count ? Number(count) : null);
  }
  return out;
}

function main(): void {
  const files = walk(WIKI);
  const pages = new Set(files.map(pageId));
  const text = new Map(files.map((f) => [pageId(f), readFileSync(f, "utf8")] as const));

  const broken: string[] = [];
  const judgement: string[] = [];
  const unsourced: string[] = [];
  const linkedFrom = new Map<string, string[]>();

  for (const [id, body] of text) {
    if (META_PAGES.has(id)) continue;

    // [[대상]] 과 [[대상|표시이름]] 둘 다 받는다. 링크 검사는 대상만 본다.
    for (const m of body.matchAll(WIKI_LINK)) {
      const target = m[1]!.trim();
      if (!linkedFrom.has(target)) linkedFrom.set(target, []);
      linkedFrom.get(target)!.push(id);
      if (!pages.has(target)) broken.push(`${id} → [[${target}]]`);
    }

    const lines = body.split("\n");
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      for (const w of BANNED) {
        if (trimmed.includes(w)) judgement.push(`${id}: "${w}" — ${trimmed.slice(0, 60)}`);
      }

      // 발언을 인용한 항목에는 출처 링크가 있어야 한다.
      // 링크는 대개 다음 줄에 이어 붙으므로 항목 전체를 본다 —
      // 같은 줄만 보면 멀쩡한 인용이 전부 걸린다.
      if (!/^-\s+\*\*[""]/.test(trimmed)) continue;
      let block = trimmed;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j]!;
        if (/^\s*-\s/.test(next) || /^#/.test(next) || next.trim() === "") break;
        block += next;
      }
      if (!block.includes("](http")) unsourced.push(`${id}: ${trimmed.slice(0, 60)}`);
    }
  }

  const orphan = [...pages].filter(
    (p) => !META_PAGES.has(p) && !linkedFrom.has(p),
  );

  // '함께 언급' 은 대칭이어야 한다. 존재뿐 아니라 건수까지 맞아야 한다 —
  // 첫 ingest 에서 정성호가 이재명을 2건이라 적고 이재명은 4건이라 적은 적이 있다.
  const asymmetric: string[] = [];
  const mismatched: string[] = [];
  for (const [id, body] of text) {
    if (!id.startsWith("people/")) continue;
    for (const [target, count] of parseMentions(body)) {
      if (!pages.has(target)) continue;
      const back = parseMentions(text.get(target) ?? "");
      if (!back.has(id)) {
        asymmetric.push(`${id} → ${target} (역방향 없음)`);
      } else {
        const backCount = back.get(id);
        if (count !== null && backCount !== null && count !== backCount) {
          mismatched.push(`${id} ↔ ${target}: ${count}건 vs ${backCount}건`);
        }
      }
    }
  }

  const groups: Array<[string, string[]]> = [
    ["깨진 링크", broken],
    ["고아 페이지 (아무도 링크하지 않음)", orphan],
    ["평가어 (스키마 위반)", judgement],
    ["출처 링크 없는 인용", unsourced],
    ["비대칭 '함께 언급'", asymmetric],
    ["'함께 언급' 건수 불일치", mismatched],
  ];

  const total = groups.reduce((s, [, list]) => s + list.length, 0);
  const linkCount = [...linkedFrom.values()].reduce((s, l) => s + l.length, 0);
  console.log(`페이지 ${pages.size}개 · 링크 ${linkCount}개 · 문제 ${total}건\n`);

  for (const [label, list] of groups) {
    console.log(`${label}: ${list.length}건`);
    for (const p of list.slice(0, 15)) console.log(`  - ${p}`);
    if (list.length > 15) console.log(`  … 외 ${list.length - 15}건`);
  }

  // 발견한 것을 고치지 않는다. 사람이 판단한다.
  if (total > 0) {
    console.log(`\n고치지 않았습니다. 스키마대로 사람이 판단합니다.`);
    process.exit(1);
  }
}

main();
