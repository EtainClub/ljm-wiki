import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 로컬 스크립트용 .env.local 로더.
 *
 * dotenv 를 넣지 않는다 — 필요한 게 KEY=VALUE 몇 줄뿐이고, 배포되는
 * 함수는 Secret Manager 를 쓰므로 런타임 의존성을 늘릴 이유가 없다.
 *
 * functions/.env.local 과 저장소 루트의 .env.local 을 모두 본다. 어느 쪽에
 * 넣었는지 기억하지 않아도 되게 하려는 것이다. 가까운 파일이 우선이고,
 * 이미 환경에 있는 값은 덮어쓰지 않는다.
 */
export function loadLocalEnv(dir = process.cwd()): void {
  for (let up = 0; up <= 2; up++) {
    const path = join(dir, ...Array(up).fill(".."), ".env.local");
    loadFile(path);
  }
}

function loadFile(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** 없으면 무엇을 어디에 넣어야 하는지 알려주고 종료한다. */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(
      `${key} 가 없습니다.\n` +
        `.env.local 에 ${key}=... 을 넣어 주세요 — functions/ 아래든 저장소 루트든\n` +
        `둘 다 읽습니다 (.gitignore 로 보호됩니다).\n` +
        `배포본은 Secret Manager 를 씁니다: firebase functions:secrets:set ${key}`,
    );
    process.exit(1);
  }
  return value;
}
