import type { Metadata, Viewport } from "next";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { BRAND } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    title: BRAND.shortName,
    statusBarStyle: "black-translucent",
  },
  icons: {
    // 32px 를 먼저 둔다 — 브라우저 탭은 작게 그린다.
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  // 사건 페이지는 자기 og.png 로 덮어쓴다. 여기 것은 홈·위키·방법 등 나머지 전부에 쓰인다.
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "ko_KR",
    url: SITE_URL,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${BRAND.name} — ${BRAND.short}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    images: ["/og.png"],
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
              {BRAND.name}
            </Link>
            <span className="hidden text-xs text-zinc-400 sm:inline">
              {BRAND.tagline}
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
