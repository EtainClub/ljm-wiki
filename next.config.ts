import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase App Hosting은 Next 서버를 실행한다. 사건 데이터는 Firestore에서
  // 요청 시점에 읽으므로 정적 export로 고정하지 않는다.
  images: { unoptimized: true },
  trailingSlash: true,
  // firebase-admin 은 서버에서 Firestore 를 읽는 node 전용 패키지다.
  // 번들러가 손대면 네이티브 의존성에서 깨지므로 외부로 둔다.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
