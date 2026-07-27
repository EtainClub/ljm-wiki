import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Firebase 프로젝트 id 와 기본 호스팅 도메인.
 *
 * `.firebaserc` 를 정본으로 삼는다. firebase CLI 가 읽는 바로 그 파일이고
 * 저장소에 커밋돼 있다. 같은 값을 `.env.local` 에 또 적으면
 *
 *   - 두 곳이 어긋날 수 있고,
 *   - 저장소를 새로 받은 사람이 아무 설정 없이 빌드했을 때 조용히 샘플
 *     데이터를 보게 된다 (`.env.local` 은 gitignore 대상이다).
 *
 * 환경변수가 있으면 그쪽이 이긴다 — CI 나 스테이징에서 다른 프로젝트를
 * 가리켜야 할 때가 있다.
 */
function readRc(): string | undefined {
  try {
    const raw = readFileSync(join(process.cwd(), ".firebaserc"), "utf8");
    const parsed = JSON.parse(raw) as { projects?: Record<string, string> };
    return parsed.projects?.["default"];
  } catch {
    return undefined;
  }
}

export function firebaseProjectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? readRc()
  );
}

/**
 * 배포 도메인. Firebase Hosting 은 프로젝트마다 `<id>.web.app` 를 기본으로 준다.
 * 커스텀 도메인을 붙이면 `NEXT_PUBLIC_SITE_URL` 로 덮어쓴다.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;

  const project = firebaseProjectId();
  return project ? `https://${project}.web.app` : "https://example.com";
}
