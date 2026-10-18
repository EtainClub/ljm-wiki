import type { Metadata, Viewport } from "next";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import SiteFooter from "@/components/SiteFooter";
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
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3.5">
            <Link href="/" className="shrink-0 text-[15px] font-semibold tracking-tight">
              {BRAND.name}
            </Link>
            {/* '속통' 만으로는 무엇에 대한 사이트인지 드러나지 않아 모바일에서도 부제를 보인다. */}
            <span className="min-w-0 truncate text-xs text-zinc-400">{BRAND.tagline}</span>
            <Link
              href="/search"
              aria-label="검색"
              className="ml-auto shrink-0 rounded-md p-1 text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <line x1="16" y1="16" x2="20" y2="20" />
              </svg>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-10 pt-7">
          {children}
        </main>

        <SiteFooter />

        <BottomNav />
      </body>
    </html>
  );
}
