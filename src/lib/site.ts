/**
 * 사이트 절대 주소.
 *
 * OG·공유 카드 URL 은 절대경로여야 하고(크롤러가 상대경로를 못 따라간다),
 * 카드 이미지 하단 워터마크에도 도메인이 들어간다. 두 곳이 어긋나지 않도록
 * 한 곳에서 읽는다.
 *
 * App Hosting은 `apphosting.yaml`의 `NEXT_PUBLIC_SITE_URL`을 빌드·런타임에 쓴다.
 * 커스텀 도메인을 붙이면 그 값만 바꾸면 된다. 로컬에서는 `.env.local`로 덮어쓴다.
 */

import { siteUrl } from "./firebase-project";

const RAW = siteUrl();

/** 뒤 슬래시를 떼서 `${SITE_URL}/e/...` 가 항상 옳게 이어지도록 한다. */
export const SITE_URL = RAW.replace(/\/+$/, "");

/** 카드 워터마크에 쓰는 표시용 호스트 (프로토콜 없이). */
export const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, "");
