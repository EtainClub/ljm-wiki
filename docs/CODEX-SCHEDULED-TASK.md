# Codex 구독 예약 작업: 승인 PR 만들기

이 문서는 **추가 AI 모델 API 없이** ChatGPT 데스크톱 앱의 Codex 예약 작업으로
하루 한 번 승인 대기 PR을 만드는 절차다. 이 작업은 `ready`까지만 만들며,
`publish`, `deploy`, `main` push는 절대 하지 않는다.

동시 PR의 파일 소유권·검증 순서는 [CURATION-PRS.md](CURATION-PRS.md)가 우선한다.

## 먼저 한 번 설정할 것

1. ChatGPT 데스크톱 앱에서 이 저장소를 프로젝트로 연다.
2. 예약 작업을 KST 22:30으로 만든다. 로컬 프로젝트 모드를 선택하고, 실행 시점에
   컴퓨터와 앱이 켜져 있도록 한다.
3. GitHub Actions용 Workload Identity Federation을 구성해
   `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` secrets를 저장한다.
   `.github/workflows/publish-ready.yml`은 이 짧은 자격증명으로만 Firestore에
   접근한다. `main`의 GitHub push는 연결된 App Hosting 백엔드가 자동 롤아웃한다.

## 예약 작업 프롬프트

```text
이 저장소의 docs/AUTOMATION.md, docs/YOUTUBE.md, wiki/schema.md를 먼저 읽어라.
추가 AI API를 사용하지 말고 현재 Codex 구독으로만 작업하라.

1. 작업 트리가 깨끗하지 않거나 main 최신화가 안 되면 중단하고 보고한다.
2. curate list에서 새 후보를 조사해 기존 event와 중복되지 않는 사건을 최대 1건만 고른다.
3. 사건·발생 시각·요약·검색어를 확인하고, coverage를 서로 다른 3개 검색어로 비교한다.
4. 미보도 집합이 달라지거나, 사건 경계·발생 시각·프레임이 확실하지 않으면 아무 PR도
   만들지 말고 이유만 보고한다.
5. 기사와 유튜브 영상의 제목을 제목에 실제로 있는 표현만으로 2~4개 프레임에 배정한다.
   채널 또는 제작자의 정치 성향·의도·신뢰도를 추측하거나 쓰지 않는다.
6. curate draft(ANTHROPIC_API_KEY 필요)는 호출하지 않는다. curate frame을 사용한다.
7. show, export:sources, ready, queue:approval, wiki lint, typecheck, lint, build를 순서대로
   확인한다. PR에는 사건별 sources/, wiki/events/, ready-events marker, ingest-record만
   넣는다. 공통 index/log/people/outlets는 수정하지 않는다. CURATION-PRS.md를 따른다.
8. publish, deploy, main push, force push, 임의 파일 삭제는 절대 하지 않는다.

발행된 사건에서 뒤늦게 유튜브 영상이 발견되면 새 사건을 만들지 말고 다음만 실행한다.

1. `curate correct-youtube <eventId>`로 제목·시간 기준 정정 계획을 만든다.
2. 후보가 1건 이상일 때만 `queue:approval -- correction <eventId>`를 실행한다.
3. 정정 marker만 담은 PR을 만든다. 사용자의 병합은 같은 사건 URL에 정정을 적용하는 승인이다.

PR 제목에는 [승인 대기]와 event slug를 포함한다. PR 설명에는 사건명, coverage 검색어,
기사/영상 수, 프레임, 유튜브 제목 연결 조건, 자동 중단 조건을 쓴다.
```

사용자는 이 PR의 **Merge 버튼 한 번**으로 발행을 허락한다. 병합 뒤 workflow가 `ready`
상태를 다시 검증해 `published`로 바꾸고 파생 위키를 생성한다. 이어 `main` push를 감지한
`ljm-wiki` App Hosting 백엔드가 자동 롤아웃한다.

## 지난 사건 보도 태도 채우기 (임시 예약 작업)

보도 태도 분류가 생기기 전에 발행된 사건(2026-10-18 기준 67건, 기사·영상 1,220건)을 채운다.
`curate untoned` 가 0건을 보고하면 이 예약 작업을 끈다.

- **시각** 하루 3회 KST 10:00 · 14:00 · 18:00. 22:30 일일 뉴스 작업과 겹치지 않게 한다
  (같은 작업 트리를 쓰므로 동시에 돌면 서로 중단한다).
- **양** 한 번에 사건 최대 3건, PR 1개. 열린 태도 분류 PR이 3개 이상이면 쉰다 — 병합이 밀릴 때
  분류가 쌓여 검토 부담이 커지는 것을 막는다.
- **전제** 보도 태도 기능(`curate leads`·`tones`·`untoned`, `apply-tone-correction`)이 `main`에
  병합돼 있어야 한다.

```text
이 저장소의 .claude/skills/lee-news/SKILL.md 중 "4-1. 보도 태도 분류"와 "발행된 사건에 보도
태도를 채우는 경우", docs/CURATION-PRS.md, wiki/schema.md를 먼저 읽어라.
추가 AI API를 사용하지 말고 현재 Codex 구독으로만 작업하라.

1. 작업 트리가 깨끗하지 않거나 `git pull --ff-only`로 main 최신화가 안 되면 중단하고 보고한다.
2. `gh pr list --state open --search "태도 분류 승인 대기 in:title"`의 결과가 3개 이상이면 아무것도
   하지 않고 "병합 대기 PR이 많아 쉼"이라고 보고한다.
3. `npm --prefix functions run -s curate -- untoned`를 실행한다. "채울 것 0"이면
   "지난 사건 채우기 완료 — 예약 작업을 꺼도 됨"이라고 보고하고 끝낸다.
4. 목록 위에서부터 최대 3건을 고른다. [이어서] 표시가 있는 사건을 먼저 고른다.
5. 사건마다:
   a. `curate -- leads <ID>`로 제목과 리드를 읽는다. ⚠ 표시나 "(읽지 못함)"은 원문을 열어 첫
      문단까지 읽는다.
   b. SKILL.md 4-1의 표와 기준으로 모든 항목을 분류해 저장소 밖의 임시 JSON 파일에 쓰고
      `curate -- tones <ID> <파일>`을 실행한다. 미분류가 0건이 될 때까지 반복한다.
   c. 위키 사건 페이지를 정하고(untoned 출력의 경로, 없으면 SKILL.md 규칙대로 찾기)
      `curate -- tone-table <ID>` 출력을 SKILL.md 규칙대로 붙인다.
   d. `npm --prefix functions run -s queue:approval -- tones <ID>`
   어느 단계든 확실하지 않으면 그 사건의 위키 변경과 표식을 되돌리고 다음 사건으로 넘어간다.
6. `npm --prefix functions run -s wiki:lint`(모두 0건), `npm --prefix functions run -s typecheck`,
   `npx tsc --noEmit`, `npm run -s lint`, `npm run -s build`를 통과해야 한다.
7. 브랜치 `codex/lee-tones-YYYY-MM-DD-HHMM`. 커밋에는 `wiki/events/*.md`와
   `.automation/ready-events/*.tone-correction.json`만 넣는다. 커밋 후
   `node scripts/check-curation-pr.mjs origin/main HEAD`를 통과해야 한다.
8. push 후 PR을 만든다. 제목 `[태도 분류 승인 대기] N건: <wikiSlug, ...>`.
   본문: 사건별 유형 건수, 겉과 속 주의에 걸릴 항목(지지·호평/사실 전달 + 사건에 없는 부정
   연상어), 리드 대신 원문을 직접 읽은 항목 수, 판단이 애매했던 항목과 이유, 건너뛴 사건과 이유,
   "병합이 곧 분류 공개 승인".
9. publish, deploy, main push, force push, 다른 사건·공통 위키 파일 수정은 절대 하지 않는다.
```
