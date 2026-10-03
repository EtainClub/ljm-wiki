import assert from "node:assert/strict";
import test from "node:test";
import { getVideoRecords, filterVideoRecords, titleForms, isRecentLeeVideo } from "../src/lib/youtube-records.ts";

const video = { id: "v1", sourceId: "yt_a", title: '이재명 "직접 소통" 가능할까?', url: "https://www.youtube.com/watch?v=test", publishedAt: "2026-10-03T10:00:00+09:00" };
const bundle = (slug = "event1") => ({
  event: { slug, title: "SNS 직접 소통", summary: "사건 맥락", frames: [{ label: "직접 소통 표현", itemIds: ["v1", "v1", "article", "missing"] }] },
  sources: { yt_a: { id: "yt_a", name: "관찰 채널", type: "youtube" }, press: { id: "press", name: "신문", type: "press" } },
  items: { v1: video, article: { ...video, id: "article", sourceId: "press" } },
});

test("공개 사건의 영상만 추출하고 누락 항목과 중복 프레임 참조를 제외한다", () => {
  const records = getVideoRecords([bundle()]);
  assert.equal(records.length, 1);
  assert.equal(records[0].eventSummary, "사건 맥락");
  assert.equal(records[0].frameLabel, "직접 소통 표현");
});

test("채널·사건·검색·제목 표현 필터가 함께 적용된다", () => {
  const records = getVideoRecords([bundle(), bundle("event2")]);
  assert.equal(filterVideoRecords(records, { channel: "yt_a", event: "event2", query: "  이재명 ", form: "질문형 제목" }).length, 1);
  assert.equal(filterVideoRecords(records, { channel: "unknown" }).length, 0);
  assert.equal(filterVideoRecords(records, { query: "없는 제목" }).length, 0);
});

test("제목 표기를 관찰하며 긍정·부정이나 실제 장르를 추측하지 않는다", () => {
  assert.deepEqual(titleForms('LIVE 이재명 “발언” #shorts?'), ["질문형 제목", "인용 표현", "라이브·중계 표기", "쇼츠 표기"]);
  assert.deepEqual(titleForms("이재명 관련 이야기"), ["일반 제목"]);
});

test("새 영상부터 정렬하고 사건별 연결을 보존한다", () => {
  const older = bundle("older");
  older.items.v1 = { ...video, publishedAt: "2026-10-02T10:00:00+09:00" };
  assert.deepEqual(getVideoRecords([older, bundle("newer")]).map((r) => r.eventSlug), ["newer", "older"]);
});

test("원문 링크가 없는 영상은 공개 기록에서 제외한다", () => {
  const missingUrl = bundle();
  missingUrl.items.v1 = { ...video, url: "" };
  assert.equal(getVideoRecords([missingUrl]).length, 0);
});

test("최근 영상은 명시된 인물명과 유효한 원문 링크로 좁히며 동명이인은 제외한다", () => {
  const url = "https://www.youtube.com/watch?v=example";
  assert.equal(isRecentLeeVideo("이재명 대통령 정책 분석", url), true);
  assert.equal(isRecentLeeVideo("이 대통령 기자회견", url), true);
  assert.equal(isRecentLeeVideo("李대통령 발언", url), true);
  assert.equal(isRecentLeeVideo("이재명 정책".normalize("NFD"), url), true);
  assert.equal(isRecentLeeVideo("트럼프 대통령 발언", url), false);
  assert.equal(isRecentLeeVideo("이재명 의사는 누구인가", url), false);
  assert.equal(isRecentLeeVideo("청년 이재명과 이완용", url), false);
  assert.equal(isRecentLeeVideo("이재명 정책", "https://youtube.com.evil.test/watch?v=example"), false);
  assert.equal(isRecentLeeVideo("이재명 정책", "javascript:alert(1)"), false);
});
