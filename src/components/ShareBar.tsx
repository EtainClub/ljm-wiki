"use client";

import { useState } from "react";

/**
 * 공유 동선은 세 갈래다.
 *  - 이미지 저장: 카톡·커뮤니티에 실제로 붙는 자산. 빌드 시 생성된 PNG 를 그냥 내려받는다.
 *  - 공유하기: 모바일 네이티브 공유 시트.
 *  - 링크 복사: 폴백.
 */
export default function ShareBar({
  title,
  cardHref,
  cardName,
}: {
  title: string;
  cardHref: string;
  cardName: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title, url: window.location.href });
    } catch {
      /* 사용자가 취소한 경우 — 무시 */
    }
  };

  return (
    <div className="space-y-3">
      <a
        href={cardHref}
        download={cardName}
        className="block rounded-lg bg-zinc-900 px-4 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        이미지로 저장
      </a>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={share}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          공유하기
        </button>
        <button
          type="button"
          onClick={copyLink}
          aria-live="polite"
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {copied ? "복사됨" : "링크 복사"}
        </button>
      </div>
      <p className="text-center text-xs text-zinc-500">
        저장한 이미지에는 기준 시각과 출처가 함께 들어갑니다.
      </p>
    </div>
  );
}
