---
name: lee-news
description: 오늘의 이재명 뉴스 사건 1건을 Firestore 초안 → 위키 → ready → 승인 대기 PR까지 등록한다. "오늘 뉴스 등록", "이재명 뉴스 등록하고 PR", 승인 대기 PR 만들기, 이전 시도(초안·미커밋 위키)를 이어서 끝내기에 쓴다. 배포·main push·publish 에는 쓰지 않는다.
---

# 오늘의 이재명 뉴스 → 승인 대기 PR

결과물은 **PR 하나**다. 사용자의 PR 병합이 유일한 발행 승인이고, 병합되면
`.github/workflows/publish-ready.yml` 이 `publish` → `wiki:people`·`wiki:outlets`
→ `wiki:lint` 를 돌려 커밋한다. 그러니 여기서 빠뜨린 것은 **병합 뒤 CI 실패**로 드러난다.

절대 하지 않는 것: `curate publish`, `npm run deploy`, `main` push/force push, PR 병합,
`curate draft`(ANTHROPIC_API_KEY 필요), 사용자의 무관한 변경 삭제.

모든 명령은 저장소 루트에서 실행한다. 아래에서 `$C` 는 다음을 뜻한다:

```bash
npm --prefix functions run -s curate --
```

`node -e` 같은 인라인 실행은 차단될 수 있다. npm 스크립트만 쓴다.

## 0. 이어하기 확인 (먼저, 반드시)

이전 시도(다른 에이전트 포함)가 중간에 멈춘 경우가 많다. 새로 만들기 전에 확인한다.

```bash
git status --short; git branch --show-current; git fetch -q && git log --oneline -1 origin/main
$C drafts                                  # 초안·승인 대기 사건
ls sources/$(date +%F) 2>/dev/null         # 이미 export 된 원본
ls wiki/events | grep "$(date +%F)"        # 이미 쓴 사건 페이지
```

- 오늘 날짜의 draft/ready 사건이 있으면 **그 사건을 이어서** 완성한다. 새로 만들지 않는다.
- 미커밋 변경이 오늘 사건의 `sources/`·`wiki/` 뿐이면 그대로 쓴다. 그 밖의 변경이 섞여 있으면
  중단하고 보고한다.
- 로컬이 `origin/main` 보다 뒤처졌으면 `git pull --ff-only`. 실패하면 중단.
- 브랜치는 `codex/lee-news-YYYY-MM-DD` (이미 있으면 그대로 사용).

## 1. 후보 고르기

```bash
npm --prefix functions run -s collect:once   # 선택: 최신 RSS·등록 유튜브 적재
$C list "이재명"
$C list "대통령"          # 필요하면 핵심어를 바꿔 여러 번
```

- `wiki/index.md` 의 사건 목록과 대조해 **중복이 아닌** 사건 1건만 고른다.
- 여러 매체(최소 2곳 이상)가 같은 발언·결정을 제목에 실은 것을 고른다.
- 뚜렷한 후보가 없으면 `후보 없음` 으로 보고하고 끝낸다 (PR 없음).

## 2. 사건 초안

```bash
$C new "<사실만 담은 제목>" "YYYY-MM-DD HH:MM"      # 출력된 id 를 ID 로 쓴다
$C set ID summary "<출처로 확인되는 2~3문장>"
$C set ID wikiSlug "YYYY-MM-DD-<읽히는-한국어-슬러그>"   # ← 필수. 빠뜨리면 병합 뒤 CI 실패
```

- 발생 시각을 모르면 회의·발표 예정 시각이나 최초 관측 보도 시각으로 추정하고, 위키에
  "(추정)" 과 근거를 적는다. 보도가 발생 시각보다 앞서면 `show` 가 막는다 → 시각을 고친다.
- `wikiSlug` 는 곧 `wiki/events/<wikiSlug>.md` 파일명이다. 두 값이 정확히 같아야 한다.
  없으면 `wiki:people`·`wiki:outlets` 가 Firestore id 로 링크해 사건 페이지가 고아가 되고
  발행 workflow 의 `wiki:lint` 가 실패한다 (2026-09-29 실제 발생). `ready` 가 이제 이를 막는다.

## 3. coverage (질의어 3개)

```bash
$C coverage ID "<질의어 A>"
$C coverage ID "<질의어 B>"
$C coverage ID "<대표 질의어>"     # ← 사건에 저장되는 질의어는 마지막으로 성공한 것
$C compare  ID "<A>" "<B>" "<대표>"
```

- 서로 의미 있게 다른 질의어 3개. `compare` 에서 미보도 집합이 크게 뒤집히면 원인을 보고
  `drop`/`attach` 로 정리하거나 `검토 필요` 로 멈춘다.
- `⚠ 시간창을 다 훑지 못했습니다` (exit 1) → 질의어를 좁히거나 시간 인자를 줄여 다시.
- **48시간 창이 아직 안 끝났다는 것은 중단 사유가 아니다.** 실행 시각(KST)을 기록하고
  위키의 "관측의 한계" 에 "이 시각까지의 관측" 이라고 쓰면 된다.
- 다른 사건 기사는 `$C drop ID <항목>`, 검색이 놓친 기사는 `$C attach ID <항목>`.
  `$C silent ID` 로 미보도 매체의 저장소 기사를 한 번 훑는다.

## 4. 프레임

```bash
$C pending ID
$C frame ID <key> "'<제목에 실제로 있는 표현>'을 앞세움" <항목8자리...>
$C videos ID "<핵심어>,<핵심어>"                  # ← 필수. 사건 창의 등록 채널 영상 후보
$C attach-youtube ID <영상항목...>               # 등록 채널 + 제목·시각이 직접 일치할 때만
$C frame ID video "'<영상 제목 표현>'을 내세움" <영상항목...>
$C show ID
```

- 한 항목은 한 프레임에만 속한다. `frame` 은 **이미 다른 프레임에 있는 항목을 옮긴다**
  — 겹치게 지정하면 먼저 만든 프레임이 비거나 사라진다. 끝나면 `show` 로 다시 본다.
- 언론 프레임 2~4개. 라벨은 제목에 실제로 있는 표현만. 매체·채널의 성향·의도·신뢰도
  서술 금지 (`wiki/schema.md` 절대 규칙).
- 유튜브는 언론의 보도/미보도 집계에 넣지 않는다 (`docs/YOUTUBE.md`).
- **영상은 반드시 `videos` 로 찾는다.** `list` 는 최근 500건만 보여 하루만 지나도 영상이
  빠진다(2026-09-30 발행 3건이 이 때문에 영상 0건으로 나갔다). 사건 핵심어(인물 이름,
  제목에 인용된 발언 낱말)를 넣어 돌리고, 제목이 이 사건을 직접 다루는 영상만 붙인다.
  여러 주제를 묶은 제목도 이 사건 표현이 들어 있으면 붙일 수 있다. 0건이면 위키에 그렇게 쓴다.
- `show` 의 `위키:` 줄에 경로가 보이고, 마지막 줄이 `✓ 승인 대기열에 넣을 수 있음` 이어야 한다.

## 5. 원본 export + 위키 작성

```bash
npm --prefix functions run -s export:sources -- --event ID     # sources/YYYY-MM-DD/*.md
```

먼저 `wiki/schema.md` 와 가장 최근 사건 페이지 1개를 읽고 형식을 그대로 따른다.

손으로 쓰는 파일 (이것만):

1. `wiki/events/<wikiSlug>.md` — 발생 기준(추정 근거 링크), 질의어 3개와 창, 언론 N곳/미발견
   M곳, 요약 1문단(출처 링크), `## 언론 기사 프레임`(프레임별 표: 시각·`[[outlets/id|이름]]`·
   「원제」 링크), `## 등록 유튜브 영상`, `## 검색에서 미발견`, `## 등장 인물`, `## 관측의 한계`.
   제목은 원문 그대로(잘린 제목도 복원하지 않음). 프레임 라벨은 Firestore 와 같은 문구.
2. `wiki/index.md` — 상단 집계(사건 페이지 수 +1, 원본 수 = `find sources -name '*.md' | wc -l`),
   사건 표 맨 위에 한 줄 추가.
3. `wiki/log.md` — 맨 위에 `## [YYYY-MM-DD] ingest | <사건> (원본 N건)` + 추정·질의어·한계.
4. `wiki/people/<인물>.md` — `<!-- generated:events -->` 목록 맨 위 한 줄 + 필요 시 관측 문단.
   제목에 새로 등장한 인물이 있으면 schema 대로 페이지를 만들고 index 에 등록한다.

`wiki/outlets/*`, `wiki/프레임-군집.md` 는 발행 workflow 가 생성한다 → **건드리지 않는다.**

## 6. 검증 → ready → marker

순서대로, 하나라도 실패하면 멈춘다 (PR 없음, draft 보존).

```bash
npm --prefix functions run -s wiki:lint      # 모든 항목 0건
npm --prefix functions run -s typecheck
npx tsc --noEmit
npm run -s lint
npm run -s build
$C ready ID                                   # wikiSlug·요약·coverage·프레임을 다시 검사
npm --prefix functions run -s queue:approval -- ID   # .automation/ready-events/ID.json
git status --short    # sources/ wiki/ .automation/ 밖의 변경이 없어야 한다
```

`ready` 뒤에 `set`/`frame`/`coverage` 를 다시 하면 draft 로 돌아간다 → `ready` 를 다시 실행.

## 7. 커밋 · PR

```bash
git checkout -b codex/lee-news-YYYY-MM-DD      # 이미 그 브랜치면 생략
git add .automation sources/YYYY-MM-DD wiki
git commit -m "curate: queue <영문 요약> event for approval"
git push -u origin HEAD
gh pr create --base main --title "[승인 대기] <wikiSlug>" --body "..."
```

PR 본문: 사건명·ID, 발생 기준(추정 여부), 질의어 3개와 매체 수, 언론 N곳/미발견 M곳,
유튜브 건수, 프레임 라벨·건수, 유튜브 연결 조건(등록 채널·제목·시각), 검증 목록,
관측의 한계, "병합이 곧 발행 승인".

병합 뒤에는 `gh run list --limit 1` 로 "Publish approved event" 가 성공했는지 확인한다.
실패하면 `gh run view <id> --log-failed` 로 원인을 보고한다.

## 발행된 사건에 유튜브가 뒤늦게 붙는 경우

새 사건을 만들지 않는다.

```bash
$C videos ID "<핵심어>,<핵심어>"                         # 후보 확인
$C correct-youtube ID                                     # 자동 규칙: 사건 제목 마지막 낱말 필수
$C correct-youtube ID "<필수어>" "<핵심어>,<핵심어>" <최소개수>   # 자동 규칙이 못 찾을 때
npm --prefix functions run -s queue:approval -- correction ID   # 후보가 1건 이상일 때만
```

- 자동 규칙은 사건 제목의 마지막 낱말을 필수어로 삼는다. 제목이 '주문'·'언급'처럼 영상 제목에
  나올 리 없는 말로 끝나면 0건이 나온다 → 영상 제목에 실제로 쓰인 낱말로 규칙을 준다.
  규칙은 사건 화면에 그대로 공개되므로, 계획에 뽑힌 영상 제목을 모두 읽고 관련 없는 영상이
  끼면 최소개수를 올리거나 필수어를 바꿔 다시 만든다.
- 위키 사건 페이지의 `## 등록 유튜브 영상` 절(규칙·표)과 머리의 영상 건수, `index`·`log` 를
  함께 고치고, marker 와 같은 PR 에 담는다.

## 최종 보고

`승인 대기 PR 생성` / `후보 없음` / `검토 필요` 중 하나 + 사건 ID, PR URL, 질의어,
기사·영상 수, 검증 결과, 막힌 이유(있으면 정확한 오류 문구).
