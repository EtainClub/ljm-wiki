/**
 * 인물 페이지의 집계 부분을 생성한다.
 *
 *   npm --prefix functions run wiki:people
 *
 * 매체 페이지와 같은 이유다. 인물 페이지의 40~65% 가 산수였고, 사건이 하나 늘 때마다
 * 사람이 모든 인물 파일의 숫자를 짝 맞춰 고쳐야 했다. wiki:lint 가 '함께 언급' 건수
 * 불일치를 이미 두 번 잡았다 — 사건이 10건이 되면 반드시 어긋난다.
 *
 * 다만 인물 페이지는 매체 페이지와 달리 **통째로 생성할 수 없다.** 발언 인용,
 * 등장 방식에 대한 서술 같은 판단이 함께 들어 있기 때문이다. 그래서 표시 구간만 바꾼다:
 *
 *   <!-- generated:events -->  …여기만 스크립트가 쓴다…  <!-- /generated -->
 *
 * **별칭은 사람이 정한다.** 「李」가 누구를 가리키는지는 기계가 판단할 수 없다.
 * 각 인물 페이지 맨 위에 이렇게 적는다:
 *
 *   <!-- aliases: 이재명, 李, 이 대통령 -->
 *
 * 세는 기준 — **그 사건에 배정된 기사** 중 제목에 별칭이 들어간 것.
 *
 * 처음에는 '사건 시간창 안의 수집분 전부' 로 셌는데 틀렸다. 07-24 에 사건이 둘 있고
 * 시간창이 거의 겹쳐서 같은 기사가 양쪽에 계산됐다 — 한동훈이 두 사건 모두 3건으로
 * 나오고 '함께 언급' 이 6건으로 부풀었다. 배정된 기사는 한 사건에만 속하므로
 * 겹치지 않는다.
 *
 * 대신 사건에 배정되지 않은 후속 기사는 세지 않는다. 그건 판단이 필요한 자료이므로
 * 인용문 같은 형태로 사람이 본문에 쓴다.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVENTS, ITEMS, db } from "../firebase";
import type { EventDoc, ItemDoc } from "../domain";
import { loadSources } from "../curate/events";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PEOPLE_DIR = join(REPO_ROOT, "wiki", "people");

interface Person {
  /** 파일 이름 = 위키 id (people/정성호 의 '정성호') */
  id: string;
  file: string;
  text: string;
  aliases: string[];
}

interface Appearance {
  eventSlug: string;
  eventDate: string;
  /** 제목에 이 인물이 등장한 기사 수 */
  count: number;
  /** 그 기사를 낸 매체 id */
  outletIds: Set<string>;
}

function readPeople(): Person[] {
  return readdirSync(PEOPLE_DIR)
    .filter((n) => n.endsWith(".md"))
    .map((name) => {
      const file = join(PEOPLE_DIR, name);
      const text = readFileSync(file, "utf8");
      const id = name.replace(/\.md$/, "");
      const declared = /<!--\s*aliases:\s*(.+?)\s*-->/.exec(text)?.[1];
      const aliases = (
        declared ? declared.split(",").map((a) => a.trim()).filter(Boolean) : [id]
      ).map((a) => a.normalize("NFC"));
      return { id, file, text, aliases };
    });
}

/** 표시 구간을 통째로 갈아 끼운다. 구간이 없으면 파일을 건드리지 않는다. */
function replaceBlock(text: string, name: string, body: string): string | null {
  const re = new RegExp(
    `(<!--\\s*generated:${name}\\s*-->)[\\s\\S]*?(<!--\\s*/generated\\s*-->)`,
  );
  if (!re.test(text)) return null;
  return text.replace(re, `$1\n${body}\n$2`);
}

/**
 * 같은 「李」가 두 코드포인트로 온다.
 *
 *  - U+674E : 보통의 CJK 한자 (동아일보)
 *  - U+F9E1 : CJK 호환 한자   (조선일보·이데일리·뉴스1·국민일보·세계일보…)
 *
 * 한국 언론사 편집 시스템이 호환 한자를 그대로 내보낸다. 그냥 비교하면 절반이
 * 어긋난다 — 실제로 이재명의 등장 건수가 21건이어야 할 자리에 13건으로 나왔다.
 *
 * NFC 는 호환 한자의 정규 분해(singleton)를 적용해 U+F9E1 을 U+674E 로 바꾼다.
 * **비교할 때만** 정규화한다. 저장된 제목은 원문 그대로 두어야 한다 —
 * 스키마가 제목을 원문대로 인용하라고 요구한다.
 */
const norm = (s: string): string => s.normalize("NFC");

const mentions = (title: string, aliases: string[]): boolean => {
  const t = norm(title);
  return aliases.some((a) => t.includes(a));
};

async function main(): Promise<void> {
  const people = readPeople();
  const missing = people.filter((p) => !/<!--\s*generated:events\s*-->/.test(p.text));
  if (missing.length > 0) {
    console.log(
      `표시 구간이 없어 건너뛴 페이지 ${missing.length}건: ${missing.map((p) => p.id).join(", ")}`,
    );
  }

  const [sources, eventsSnap, itemsSnap] = await Promise.all([
    loadSources(),
    db.collection(EVENTS).where("status", "==", "published").get(),
    db.collection(ITEMS).get(),
  ]);

  const outletNames = new Map(sources.map((s) => [s.id, s.name] as const));
  const events = eventsSnap.docs.map((d) => d.data() as EventDoc);
  const items = itemsSnap.docs.map((d) => d.data() as ItemDoc);

  // 사건별로 그 사건에 배정된 기사를 모은다. 한 기사는 한 사건에만 속한다.
  const byEvent = events.map((event) => ({
    slug: event.wikiSlug ?? event.slug,
    date: event.date,
    items: items.filter((i) => i.eventId === event.slug),
  }));
  byEvent.sort((a, b) => b.date.localeCompare(a.date));

  let written = 0;
  for (const person of people) {
    const appearances: Appearance[] = [];
    // 짝별 동시 등장 수
    const together = new Map<string, number>();

    for (const ev of byEvent) {
      const hit = ev.items.filter((i) => mentions(i.title, person.aliases));
      if (hit.length === 0) continue;

      appearances.push({
        eventSlug: ev.slug,
        eventDate: ev.date,
        count: hit.length,
        outletIds: new Set(hit.map((i) => i.sourceId)),
      });

      for (const other of people) {
        if (other.id === person.id) continue;
        const n = hit.filter((i) => mentions(i.title, other.aliases)).length;
        if (n > 0) together.set(other.id, (together.get(other.id) ?? 0) + n);
      }
    }

    // 정의를 함께 싣는다. 이 숫자는 '사건에 기록된 기사' 만 센 것이라, 본문의
    // 인용 목록(후속 기사까지 사람이 모은 것)보다 작을 수 있다. 적어 두지 않으면
    // 같은 페이지 안에서 두 숫자가 어긋난 것처럼 보인다.
    const eventsBody =
      appearances.length === 0
        ? "사건 표에 오른 기사 중에는 이 인물이 제목에 등장한 것이 없다.\n" +
          "이 인물은 사건 표에 오르지 않은 후속 기사에만 나온다 — 아래 본문 참조."
        : [
            ...appearances.map(
              (a) =>
                `- [[events/${a.eventSlug}]] — ${a.eventDate} · 제목에 등장 ${a.count}건 (${a.outletIds.size}곳)`,
            ),
            "",
            "*사건에 기록된 기사만 셌다. 사건 표에 오르지 않은 후속 기사는 아래 본문에 있다.*",
          ].join("\n");

    const linkRows = [...together.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
    const linksBody = [
      "### 함께 언급된 인물",
      "",
      "같은 제목에 등장했다는 관측일 뿐, 관계의 근거가 아니다.",
      "",
      linkRows.length === 0
        ? "사건 표에 오른 기사 중에는 함께 등장한 인물이 없다."
        : linkRows.map(([id, n]) => `- [[people/${id}]] ${n}건`).join("\n"),
      "",
      "### 이 인물을 다룬 매체",
      "",
      (() => {
        const all = new Set<string>();
        for (const a of appearances) for (const id of a.outletIds) all.add(id);
        if (all.size === 0) return "없다.";
        return (
          `제목에 이 인물을 넣은 곳 ${all.size}곳.\n\n` +
          [...all]
            .sort((a, b) =>
              (outletNames.get(a) ?? a).localeCompare(outletNames.get(b) ?? b, "ko"),
            )
            .map((id) => `[[outlets/${id}|${outletNames.get(id) ?? id}]]`)
            .join(" · ")
        );
      })(),
    ].join("\n");

    let next = replaceBlock(person.text, "events", eventsBody);
    if (next === null) continue;
    const withLinks = replaceBlock(next, "links", linksBody);
    if (withLinks !== null) next = withLinks;

    if (next !== person.text) {
      writeFileSync(person.file, next, "utf8");
      written++;
    }
  }

  console.log(`인물 페이지 ${written}건 갱신 · wiki/people/`);
  console.log("기준 — 각 사건에 배정된 기사 중 제목에 별칭이 든 것");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
