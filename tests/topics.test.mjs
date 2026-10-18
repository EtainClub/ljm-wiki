import assert from "node:assert/strict";
import test from "node:test";
import { getTopic, topicsOf } from "../src/lib/topics.ts";

const labels = (title) => topicsOf(title).map((topic) => topic.key);

test("제목 핵심어로 쟁점을 정하고 여러 쟁점에 동시에 들 수 있다", () => {
  assert.deepEqual(labels("이재명 김지용 중수청장 임명안 재가"), ["prosecution-reform", "appointments"]);
  assert.deepEqual(labels("이재명 리얼미터 국정수행 지지율 35.2% 발표 보도"), ["approval"]);
});

test("핵심어가 없으면 어느 쟁점에도 넣지 않는다", () => {
  assert.deepEqual(labels("이재명 한글날 100주년 메시지 보도"), []);
});

test("CJK 호환 한자 제목도 같은 규칙으로 분류한다", () => {
  // 「李」U+F9E1 은 NFC 로 U+674E 가 된다. 규칙어는 한글이지만 제목 전체를 정규화해 비교한다.
  assert.deepEqual(labels("李 대통령 \"부마항쟁·5·18, 헌법에 담아야\""), ["constitution"]);
});

test("임통과 같은 쟁점은 임통 주소를 갖는다", () => {
  assert.equal(getTopic("prosecution-reform")?.im, "prosecution-reform");
  assert.equal(getTopic("sns")?.im, undefined);
});
