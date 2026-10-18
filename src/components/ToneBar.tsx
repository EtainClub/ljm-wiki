import type { ToneKey } from "@/lib/event-types";
import { TONES } from "@/lib/tone";

/** 보도 태도 분포 막대와 범례. 사건 페이지와 분석 페이지가 함께 쓴다. */
export default function ToneBar({ label, tones }: { label: string; tones: ToneKey[] }) {
  const counts = TONES.map((def) => ({ def, n: tones.filter((t) => t === def.key).length })).filter(
    ({ n }) => n > 0,
  );
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-zinc-500">
        {label} <span className="tabular-nums">{tones.length}</span>
      </p>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {counts.map(({ def, n }) => (
          <div
            key={def.key}
            className={def.bar}
            style={{ width: `${(n / tones.length) * 100}%` }}
            title={`${def.label} ${n}`}
          />
        ))}
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {counts.map(({ def, n }) => (
          <div key={def.key} className="flex items-center gap-1.5">
            <span className={`size-2 shrink-0 rounded-full ${def.bar}`} />
            <dt className="text-zinc-600 dark:text-zinc-400">{def.label}</dt>
            <dd className="font-semibold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
