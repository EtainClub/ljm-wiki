import "server-only";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { marked } from "marked";

/**
 * 위키 마크다운을 정적 페이지로 읽는다.
 *
 * 위키의 원본은 저장소의 마크다운이다 — Firestore 가 아니다. 그래야
 * 에이전트가 편집한 내용을 사람이 git diff 로 검토하고 커밋할 수 있다.
 * 사이트는 커밋된 마크다운을 빌드 시 읽어 정적 HTML 로 뽑는다.
 */

const WIKI_DIR = join(process.cwd(), "wiki");

/** 규칙·색인·이력은 위키 문서와 성격이 다르므로 목록에서 분리한다. */
const META = new Set(["schema", "index", "log"]);

export interface WikiPage {
  /** "people/정성호" */
  id: string;
  /** URL 세그먼트 배열 */
  slug: string[];
  title: string;
  html: string;
  kind: "people" | "outlets" | "events" | "meta";
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

/**
 * `[[people/정성호]]` → 링크. `[[outlets/chosun|조선일보]]` 처럼 표시 이름을 줄 수 있다.
 *
 * 별칭이 필요한 곳은 매체 표다 — 링크 글자가 `chosun` 이면 읽을 수 없다.
 * 마크다운 표 안에서도 안전하다: 이 치환이 표 파싱보다 먼저 돌아 `|` 가 사라진다.
 *
 * 존재하지 않는 대상은 링크로 만들지 않는다. 죽은 링크를 눌러 404 를 보는 것보다
 * 링크가 아닌 편이 낫고, 어차피 wiki:lint 가 깨진 링크를 따로 잡는다.
 */
function resolveWikiLinks(md: string, known: Set<string>): string {
  return md.replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (_, raw: string, alias?: string) => {
    const target = raw.trim();
    const label = alias?.trim() || target.split("/").pop() || target;
    if (!known.has(target)) return label;
    const href = `/w/${target.split("/").map(encodeURIComponent).join("/")}`;
    return `[${label}](${href})`;
  });
}

function kindOf(id: string): WikiPage["kind"] {
  if (id.startsWith("people/")) return "people";
  if (id.startsWith("outlets/")) return "outlets";
  if (id.startsWith("events/")) return "events";
  return "meta";
}

let cache: WikiPage[] | null = null;

export function getWikiPages(): WikiPage[] {
  if (cache) return cache;

  let files: string[];
  try {
    files = walk(WIKI_DIR);
  } catch {
    console.warn("[wiki] wiki/ 를 찾지 못했습니다 — 위키 페이지 없이 빌드합니다.");
    cache = [];
    return cache;
  }

  const ids = files.map((f) => relative(WIKI_DIR, f).replace(/\.md$/, ""));
  const known = new Set(ids);

  cache = files.map((file, i) => {
    const id = ids[i]!;
    const raw = readFileSync(file, "utf8");
    const title = /^#\s+(.+)$/m.exec(raw)?.[1]?.trim() ?? id;

    // 첫 h1 은 페이지 제목으로 따로 렌더하므로 본문에서 뺀다.
    const body = raw.replace(/^#\s+.+$/m, "");

    return {
      id,
      slug: id.split("/"),
      title,
      // 표는 넓다. 페이지 전체가 아니라 표만 가로 스크롤되도록 감싼다 —
      // 감싸지 않으면 모바일에서 본문이 통째로 옆으로 밀린다.
      html: marked
        .parse(resolveWikiLinks(body, known), { async: false })
        .replace(/<table>/g, '<div class="table-scroll"><table>')
        .replace(/<\/table>/g, "</table></div>"),
      kind: kindOf(id),
    };
  });

  return cache;
}

export function getWikiPage(slug: string[]): WikiPage | undefined {
  return getWikiPages().find((p) => p.id === slug.join("/"));
}

/** 목록용. 메타 문서는 뺀다. */
export function getWikiPagesByKind(kind: WikiPage["kind"]): WikiPage[] {
  return getWikiPages()
    .filter((p) => p.kind === kind && !META.has(p.id))
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));
}
