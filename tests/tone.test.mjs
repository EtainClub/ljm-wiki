import assert from "node:assert/strict";
import test from "node:test";
import { isToneKey, surfaceCues } from "../src/lib/tone.ts";

const event = "이재명 부천 화재 순직 소방관 애도·예우 언급";

test("지지·사실 전달 제목에 사건에 없는 부정 연상어가 붙으면 표시한다", () => {
  assert.deepEqual(surfaceCues("李 소방관 예우 약속…탄핵 집회는 계속", "report", event), ["탄핵"]);
  assert.deepEqual(surfaceCues("소방관 챙긴 李, 지지율 하락 막을까", "support", event), ["지지율 하락"]);
});

test("비판·비난으로 분류된 제목에는 겉과 속 표시를 하지 않는다", () => {
  assert.deepEqual(surfaceCues("李 소방관 예우…탄핵 피하려는 쇼", "attack", event), []);
});

test("사건 자체에 있는 말은 덧붙인 말이 아니다", () => {
  const poll = "이재명 지지율 하락 리얼미터 발표";
  assert.deepEqual(surfaceCues("李 지지율 하락, 2주 연속", "report", poll), []);
});

test("'하락'·'논란' 같은 흔한 낱말만으로는 표시하지 않는다", () => {
  assert.deepEqual(surfaceCues("李 지지율 35.2%, 2주 연속 하락", "report", event), []);
  assert.deepEqual(surfaceCues("SNS 대외비 문건 공개 논란", "report", event), []);
});

test("알 수 없는 유형은 받지 않는다", () => {
  assert.equal(isToneKey("report"), true);
  assert.equal(isToneKey("hostile"), false);
});
