import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase Hosting(일반)은 정적 파일 서버 + CDN 이다. SSR·ISR·route handler(동적)
  // 이 없으므로 전량 SSG 로 뽑고, 콘텐츠 갱신은 재빌드+재배포로 처리한다.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // firebase-admin 은 빌드 타임에 Firestore 를 읽을 때만 쓰는 node 전용 패키지다.
  // 번들러가 손대면 네이티브 의존성에서 깨지므로 외부로 둔다.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
