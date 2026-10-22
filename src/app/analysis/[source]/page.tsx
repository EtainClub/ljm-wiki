import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ToneBar from "@/components/ToneBar";
import { getPublishedEvents } from "@/lib/events-source";
import { formatLongDate } from "@/lib/kst";
import { TONES, isToneKey, toneDef } from "@/lib/tone";
import { outletHref, toneRows } from "@/lib/tone-rows";

export const dynamic = "force-dynamic";

type Params = Promise<{ source: string }>;

async function outletRows(params: Params) {
  const sourceId = decodeURIComponent((await params).source);
  const { rows } = toneRows(await getPublishedEvents());
  return rows.filter((r) => r.item.sourceId === sourceId);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const rows = await outletRows(params);
  const name = rows[0]?.source?.name;
  if (!name) return { title: "보도 태도 분석" };
  return {
    title: `${name} 보도 태도`,
    description: `${name}의 기사·영상 ${rows.length}건을 어떻게 분류했는지와 그 근거.`,
  };
}

/**
 * 분석 화면 표의 한 줄을 펼친 화면이다. 건수 뒤의 기사·영상과 근거를 그대로 보여준다.
 * 매체 전체를 평가하지 않는다 — 분류된 보도만 사건 순으로 둔다.
 */
export default async function OutletAnalysisPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [all, query] = await Promise.all([outletRows(params), searchParams]);
  if (all.length === 0) notFound();

  const source = all[0]!.source;
  const sourceId = all[0]!.item.sourceId;
  const name = source?.name ?? sourceId;
  const tone = isToneKey(query.tone) ? query.tone : undefined;
  const rows = (tone ? all.filter((r) => r.tone.tone === tone) : all).sort(
    (a, b) => Date.parse(b.item.publishedAt) - Date.parse(a.item.publishedAt),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/analysis/" className="text-sm text-zinc-500 underline underline-offset-4">
          ← 보도 태도 분석
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        <p className="text-sm text-zinc-500">
          {source?.type === "youtube" ? "유튜브 채널" : "언론사"} · 분류 {all.length}건 · 사건{" "}
          {new Set(all.map((r) => r.event.slug)).size}건
        </p>
        <ToneBar label="보도 태도" tones={all.map((r) => r.tone.tone)} />
      </header>

      <nav className="flex flex-wrap gap-2">
        <Chip href={outletHref(sourceId)} active={!tone} label="전체" count={all.length} />
        {TONES.map((def) => {
          const n = all.filter((r) => r.tone.tone === def.key).length;
          if (n === 0) return null;
          return (
            <Chip key={def.key} href={outletHref(sourceId, def.key)} active={tone === def.key} label={def.label} count={n} />
          );
        })}
      </nav>

      <ul className="space-y-6">
        {rows.map((r) => (
          <li key={r.item.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                <span className={`size-1.5 rounded-full ${toneDef(r.tone.tone).bar}`} />
                {toneDef(r.tone.tone).label}
              </span>
              {r.cues.length > 0 && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                  겉과 속 주의: {r.cues.join("·")}
                </span>
              )}
            </div>
            <a
              href={r.item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[15px] leading-6 underline-offset-4 hover:underline"
            >
              {r.item.title}
            </a>
            <p className="text-xs leading-5 text-zinc-500">{r.tone.basis}</p>
            <Link href={`/e/${r.event.slug}/`} className="text-xs text-zinc-500 underline underline-offset-4">
              {formatLongDate(r.event.occurredAt)} · {r.event.title}
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        분류는 기사·영상 하나하나에 붙인 것이고, 매체·채널의 성향을 매긴 것이 아닙니다.{" "}
        <Link href="/method#tone" className="underline underline-offset-4">분류 기준과 한계</Link>
      </p>
    </div>
  );
}

function Chip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
      }`}
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </Link>
  );
}
