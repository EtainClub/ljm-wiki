# Codex 구독 예약 작업: 승인 PR 만들기

이 문서는 **추가 AI 모델 API 없이** ChatGPT 데스크톱 앱의 Codex 예약 작업으로
하루 한 번 승인 대기 PR을 만드는 절차다. 이 작업은 `ready`까지만 만들며,
`publish`, `deploy`, `main` push는 절대 하지 않는다.

## 먼저 한 번 설정할 것

1. ChatGPT 데스크톱 앱에서 이 저장소를 프로젝트로 연다.
2. 예약 작업을 KST 22:30으로 만든다. 로컬 프로젝트 모드를 선택하고, 실행 시점에
   컴퓨터와 앱이 켜져 있도록 한다.
3. GitHub Actions용 Workload Identity Federation을 구성해
   `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` secrets를 저장한다.
   `.github/workflows/publish-ready.yml`은 이 짧은 자격증명으로만 Firestore와 Hosting에
   접근한다.

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
7. show, ready, export:sources, wiki lint, typecheck, lint, build가 모두 통과한 경우에만
   queue:approval을 실행하고 허용된 sources/, wiki/, .automation/ 경로만 담은 PR을 만든다.
8. publish, deploy, main push, force push, 임의 파일 삭제는 절대 하지 않는다.

PR 제목에는 [승인 대기]와 event slug를 포함한다. PR 설명에는 사건명, coverage 검색어,
기사/영상 수, 프레임, 자동 중단 조건을 쓴다.
```

사용자는 이 PR의 **Merge 버튼 한 번**으로 발행을 허락한다. 병합 뒤 workflow가 `ready`
상태를 다시 검증해 `published`로 바꾸고, 파생 위키·정적 사이트를 생성·배포한다.
