"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * PWA 셸의 하단 탭.
 *
 * 사건 상세(/e/...)는 탭이 아니다 — 공유 링크로 바로 들어오는 자리이고,
 * '오늘' 탭에서 이어지는 화면이므로 '오늘'을 활성으로 둔다.
 */
const TABS = [
  { href: "/", label: "오늘", icon: BarsIcon, match: (p: string) => p === "/" || p.startsWith("/e/") },
  { href: "/archive", label: "지난", icon: ClockIcon },
  // 매체 목록은 /w 와 /method 양쪽에서 닿는다. 탭은 위키에 내준다 —
  // 누적되는 기록이 이 제품의 깊이이고, 매체 목록은 참고 문서다.
  { href: "/w", label: "위키", icon: ListIcon },
  { href: "/method", label: "방법", icon: InfoIcon },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const current = pathname.replace(/\/+$/, "") || "/";

  return (
    <nav
      aria-label="주요 메뉴"
      className="sticky bottom-0 z-10 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {TABS.map((tab) => {
          const active =
            "match" in tab && tab.match
              ? tab.match(current)
              : current === tab.href;
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition ${
                  active
                    ? "font-semibold text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                <Icon />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const svgProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** 비율 바를 세로로 쌓은 모양 — 앱 아이콘과 같은 기호 */
function BarsIcon() {
  return (
    <svg {...svgProps}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="15" y2="12" />
      <line x1="4" y1="17" x2="10" y2="17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="12 7.5 12 12 15 13.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...svgProps}>
      <line x1="9" y1="7" x2="20" y2="7" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="17" x2="20" y2="17" />
      <circle cx="4.75" cy="7" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="4.75" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="4.75" cy="17" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.9" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}
