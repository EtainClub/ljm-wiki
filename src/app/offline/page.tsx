import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "오프라인",
  description: "네트워크에 연결되어 있지 않습니다.",
};

/** 서비스 워커가 캐시에도 없는 화면을 요청받았을 때 보여주는 대체 페이지. */
export default function OfflinePage() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-xl font-bold tracking-tight">오프라인입니다</h1>
      <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
        네트워크에 연결되면 다시 불러옵니다. 이미 열어 본 사건은 연결 없이도
        볼 수 있습니다.
      </p>
      <p>
        <Link
          href="/"
          className="text-sm underline underline-offset-4"
        >
          오늘의 사건으로
        </Link>
      </p>
    </div>
  );
}
