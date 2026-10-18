import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCurationDiff } from "./check-curation-pr.mjs";

const marker = { status: "A", path: ".automation/ready-events/2026-10-18-aaaaaa.json" };
const record = { status: "A", path: ".automation/ingest-records/2026-10-18-aaaaaa.json" };
test("공통 파일 수정과 누락된 record를 거부한다", () => {
  for (const path of ["wiki/index.md", "wiki/log.md", "wiki/people/이재명.md", "wiki/people/새인물.md", "wiki/outlets/news1.md", "wiki/프레임-군집.md"]) {
    assert.equal(checkCurationDiff([marker, record, { status: "M", path }]).length, 1);
  }
  assert.equal(checkCurationDiff([marker]).length, 1);
});
test("사건별 입력·marker-only 정정·일반 코드 PR을 허용한다", () => {
  assert.deepEqual(checkCurationDiff([marker, record, { status: "A", path: "wiki/events/2026-10-18-사건.md" }]), []);
  assert.deepEqual(checkCurationDiff([{ status: "A", path: ".automation/ready-events/2026-10-18-aaaaaa.youtube-correction.json" }]), []);
  assert.deepEqual(checkCurationDiff([{ status: "M", path: "scripts/publish-regenerate.sh" }]), []);
});
