import "server-only";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { marked } from "marked";
import { REPO_URL } from "./site";

/**
 * 위키 마크다운을 정적 페이지로 읽는다.
 *
 * 위키의 원본은 저장소의 마크다운이다 — Firestore 가 아니다. 그래야
 * 에이전트가 편집한 내용을 사람이 git diff 로 검토하고 커밋할 수 있다.
 * 사이트는 커밋된 마크다운을 빌드 시 읽어 정적 HTML 로 뽑는다.
 */

const ROOT_DIR = process.cwd();
const WIKI_DIR = join(ROOT_DIR, "wiki");

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
  /** 사건 페이지가 선언한 Firestore 사건 slug (`- **사건 ID** `...``). */
  eventSlug?: string;
  /** 본문의 `[[...]]` 대상 중 실제 있는 페이지 id. 처음 나온 순서. */
  links: string[];
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

/**
 * `[조사 기록](../../docs/YOUTUBE-2026-10-15.md)` 처럼 위키 바깥(docs/·sources/)을
 * 가리키는 상대 링크 → 공개 저장소의 해당 파일.
 *
 * 저장소에서는 맞는 경로지만 사이트에는 docs/·sources/ 가 빌드되지 않아
 * 그대로 두면 /docs/....md 404 로 떨어졌다. 위키 안을 가리키는 링크는 건드리지 않는다.
 */
function resolveRepoLinks(md: string, file: string): string {
  return md.replace(/\]\((\.{1,2}\/[^)\s#]+)(#[^)\s]*)?\)/g, (match, target: string, hash = "") => {
    const path = relative(ROOT_DIR, join(dirname(file), target)).split(sep).join("/");
    if (path.startsWith("wiki/") || path.startsWith("..")) return match;
    return `](${REPO_URL}/blob/main/${path.split("/").map(encodeURIComponent).join("/")}${hash})`;
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
    const eventSlug = /^- \*\*사건 ID\*\* `([^`]+)`/m.exec(raw)?.[1];
    const links = [
      ...new Set(
        [...raw.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g)]
          .map((m) => m[1]!.trim())
          .filter((target) => known.has(target)),
      ),
    ];

    return {
      id,
      slug: id.split("/"),
      title,
      // 표는 넓다. 페이지 전체가 아니라 표만 가로 스크롤되도록 감싼다 —
      // 감싸지 않으면 모바일에서 본문이 통째로 옆으로 밀린다.
      html: marked
        .parse(resolveRepoLinks(resolveWikiLinks(body, known), file), { async: false })
        .replace(/<table>/g, '<div class="table-scroll"><table>')
        .replace(/<\/table>/g, "</table></div>"),
      kind: kindOf(id),
      ...(eventSlug ? { eventSlug } : {}),
      links,
    };
  });

  return cache;
}

export function getWikiPage(slug: string[]): WikiPage | undefined {
  return getWikiPages().find((p) => p.id === slug.join("/"));
}

/**
 * 사건 페이지(/e/...) 에서 위키로 넘어가는 다리. 두 주소는 이름이 다르다 —
 * 사이트는 해시 slug, 위키는 설명형 파일명 — 그래서 위키 사건 페이지가 적어 둔
 * '사건 ID' 로 잇는다. 위키 기록이 아직 없는 사건은 빈 값이다.
 */
export function getWikiForEvent(event: { slug: string; date: string; title: string }): {
  page?: WikiPage;
  people: WikiPage[];
} {
  const pages = getWikiPages().filter((p) => p.kind === "events");
  const norm = (s: string) => s.normalize("NFC").trim();
  // '사건 ID' 줄은 2026-10 이후 사건에만 있다. 그 전 사건은 날짜(파일명 앞부분)와
  // 제목이 모두 같을 때만 잇는다 — 하나만 맞으면 다른 사건일 수 있다.
  const page =
    pages.find((p) => p.eventSlug === event.slug) ??
    pages.find(
      (p) =>
        !p.eventSlug &&
        p.id.startsWith(`events/${event.date}-`) &&
        norm(p.title) === norm(event.title),
    );
  if (!page) return { people: [] };
  const people = page.links
    .filter((id) => id.startsWith("people/"))
    .map((id) => getWikiPages().find((p) => p.id === id))
    .filter((p): p is WikiPage => Boolean(p));
  return { page, people };
}

/** 목록용. 메타 문서는 뺀다. */
export function getWikiPagesByKind(kind: WikiPage["kind"]): WikiPage[] {
  return getWikiPages()
    .filter((p) => p.kind === kind && !META.has(p.id))
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));
}
