import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** 뉴스 승인 PR은 공통 산출물을 소유하지 않는다. merge driver/자동 ours로 손실을 숨기지 않는다. */
export function checkCurationDiff(entries) {
  if (!entries.some(({ path }) => /^\.automation\/ready-events\/[^/]+\.json$/.test(path))) return [];
  const errors = [];
  for (const { path } of entries) {
    if (/^wiki\/(index\.md|log\.md|프레임-군집\.md)$/.test(path) || /^wiki\/(people|outlets)\//.test(path)) {
      errors.push(`공통 파일은 승인 PR에서 수정하지 않습니다: ${path}`);
    }
  }
  for (const { path, status } of entries) {
    const id = /^\.automation\/ready-events\/(\d{4}-\d{2}-\d{2}-[a-f0-9]{6})\.json$/.exec(path)?.[1];
    if (id && status !== "D" && !entries.some((entry) => entry.path === `.automation/ingest-records/${id}.json` && entry.status !== "D")) {
      errors.push(`사건별 ingest record가 PR에 필요합니다: ${id}`);
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, head = "HEAD"] = process.argv.slice(2);
  if (!base) throw new Error("사용법: node scripts/check-curation-pr.mjs <base> [head]");
  const fields = execFileSync("git", ["diff", "--no-renames", "--name-status", "-z", `${base}...${head}`], { encoding: "utf8" }).split("\0");
  const entries = [];
  for (let i = 0; i + 1 < fields.length; i += 2) entries.push({ status: fields[i], path: fields[i + 1] });
  const errors = checkCurationDiff(entries);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("뉴스 PR 공통 파일 충돌 방지 검사 통과");
}
