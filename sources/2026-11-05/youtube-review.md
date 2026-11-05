# 2026-11-05 유튜브 제목 2건 관측

조사 범위는 2026-11-05 00:00~21:36 KST다. 활성 등록 27개 채널 중 오마이TV·신의한수·조하나의 아일랜드·GROUND C 4곳의 최신 50개씩(200개) 메타데이터를 공식 API로 조회하고, 출력된 관련 사례 24건의 제목에서 당일 이재명 직접 제목 2건을 골랐다. 실제 원제·URL·초 단위 게시 시각·조회 시각은 [공식 API 원본](youtube-review.metadata.jsonl)에 남겼다.

| 게시 시각 (KST, 공식 API) | 채널 | 원제 | 불변 원본 |
|---|---|---|---|
| 11-05 14:09:29 | [오마이TV](https://www.youtube.com/channel/UClAfLVQYZSLrMAQQ_SXPVZw) | [「'수능 D-14' 이재명 대통령 "스마트안경 같은 부정행위 차단에 각별한 노력 기울여야"」](https://www.youtube.com/watch?v=do_VHfbt8Uk) | [수집 원본](yt_UClAfLVQYZSLrMAQQ_SXPVZw-8f83457b.md) |
| 11-05 18:06:08 | [조하나의 아일랜드](https://www.youtube.com/channel/UC8Hl-XsjNw9PM2oeYlrg_yQ) | [「왜곡되지 않을 권리, 오해하지 않을 의무｜이재명 대통령 SNS 논란」](https://www.youtube.com/watch?v=3JcCtUSrLag) | [수집 원본](yt_UC8Hl-XsjNw9PM2oeYlrg_yQ-ab48429c.md) |

두 영상은 기존 수집기에서 적재한 항목이며 이번 `export:sources -- --since 2026-11-05 --match '왜곡되지 않을 권리,스마트안경 같은 부정행위'`가 정확히 2건을 기록했다. 두 원제·URL·분 단위 시각은 공식 API와 일치한다. 기준 main의 sources·wiki에는 두 URL의 기존 등록이 없었다. [수집 원본 1](yt_UClAfLVQYZSLrMAQQ_SXPVZw-8f83457b.md) · [수집 원본 2](yt_UC8Hl-XsjNw9PM2oeYlrg_yQ-ab48429c.md)

오마이TV 원제는 수능 부정행위 차단을, 조하나의 아일랜드 원제는 SNS 논란을 앞세운다. 두 제목은 같은 PR의 [부동산 단속 예고](../../wiki/events/2026-11-05-이재명-부동산투기-3차-단속-예고.md)·[장남 고소 보도](../../wiki/events/2026-11-05-이재명-장남-주진우-명예훼손-고소.md)와 직접 일치하지 않아 사건에 연결하지 않는다. SNS라는 공통 낱말만으로 과거 SNS 사건에도 연결하지 않는다. [공식 API 원본](youtube-review.metadata.jsonl)

**내용 미확인 — 제목 관찰만.** 영상 내용·전사·실제 발언 구간의 확인은 0건이다. 제목의 평가를 사실로 재서술하지 않으며 두 영상을 같은 사건의 비교 대상으로 삼지 않는다. 오마이TV의 당일 다른 사례는 채널별 1건 선정 범위에서 제외했고, 신의한수·GROUND C는 출력 사례에 당일 API 게시분이 없었다. 신의한수 첫 사례는 제목에 11월 4일을 적었지만 API 게시 시각은 11월 5일 00:55이며 어제 사건에 이미 등록된 영상이어서 중복 등록하지 않았다. [어제 사건](../../wiki/events/2026-11-04-이재명-사랑제일교회-강제집행-발언.md) · [API 관측](youtube-review.metadata.jsonl)

각 채널 최신 50개 중 출력 사례 최대 6개만 검토한 표본이며 전체 업로드 전수조사가 아니다. API publishedAt은 생방송 시작 시각으로 해석하지 않는다. 삭제·비공개·미등록 채널과 관측 후 영상은 포함하지 않는다. 새 채널·사건 연결·정정 marker는 0건이며, 두 뉴스 사건의 승인 marker와 별개인 원본 등록이다. `/youtube` 최근 목록의 노출은 기간·채널별 개수 제한을 받는다. [표시 범위](../../docs/YOUTUBE.md#화면과-분석의-한계)
