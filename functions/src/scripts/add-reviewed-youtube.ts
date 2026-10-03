/** 검토 근거가 기록된 채널 목록을 기존 ID 검증·등록 명령으로 적용한다. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(__dirname, "..", "..", "..");
const rows = JSON.parse(readFileSync(join(root, "src/data/youtube-channel-additions.json"), "utf8")) as Array<{
  name: string;
  channelId: string;
  displayOrder: number;
  evidenceUrls: string[];
}>;

for (const row of rows) {
  if (!row.name || !/^UC[\w-]{22}$/.test(row.channelId) || row.evidenceUrls.length < 2) {
    throw new Error(`채널 검토 기록을 확인하세요: ${row.name}`);
  }
}

for (const row of rows) {
  const result = spawnSync(process.execPath, [
    join(__dirname, "add-youtube-source.js"), row.name, row.channelId, String(row.displayOrder),
  ], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
