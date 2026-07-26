import type { Metadata, Viewport } from "next";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "같은 사건, 다른 제목",
    template: "%s · 같은 사건, 다른 제목",
  },
  description:
    "하나의 사건에 언론과 채널이 어떤 제목을 달았는지, 그리고 어디가 다루지 않았는지 그대로 모아 봅니다.",
  applicationName: "같은 사건, 다른 제목",
  appleWebApp: {
    capable: true,
    title: "같은사건",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 홈 화면에서 실행했을 때 노치·홈 인디케이터 영역까지 배경을 채운다.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <ServiceWorkerRegister />

        <header
          className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex w-full max-w-2xl items-baseline gap-3 px-5 py-3.5">
            <Link href="/" className="text-[15px] font-semibold tracking-tight">
              같은 사건, 다른 제목
            </Link>
            <span className="hidden text-xs text-zinc-400 sm:inline">
              제목을 그대로 모아 놓습니다
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-10 pt-7">
          {children}
        </main>

        <p className="mx-auto w-full max-w-2xl px-5 pb-6 text-xs text-zinc-500">
          모든 제목은 원문 링크가 걸린 인용입니다.
        </p>

        <BottomNav />
      </body>
    </html>
  );
}
