# 승인 기사 발행 복구

사이트 사건 목록은 요청마다 Firestore의 `status=published` 사건을 읽는다.
기사 PR의 병합은 `.automation/ready-events/` 승인 표식을 main에 추가하지만,
Firestore의 `ready → published` 변경은 `Publish approved event` Actions가 수행한다.
App Hosting 배포만 성공해도 이 발행 작업이 실행되지 않으면 새 사건은 표시되지 않는다.

2026-10-13 복구 시 저장소 Actions의 `enabled=false`를 확인했다. 저장소에서
활성화를 시도하면 조직 정책으로 금지됐다는 HTTP 409가 반환됐다.
조직 관리자는 EtainClub → Settings → Actions → General에서 저장소 실행을 허용해야 한다.
또한 마지막 실행(2026-10-04)은 새 인물의 집계 구간 누락으로 `wiki:lint`에서 실패했다.
인물 생성기는 이제 사건 집계 구간 유무와 별개로 동시 언급 집계를 갱신한다.

## 정상 실행과 재시도

- 승인 표식을 담은 PR이 main에 병합되면 자동 실행한다.
- 발행 스크립트나 workflow 수정도 재실행을 유발한다.
- Actions 화면의 Run workflow로 최신 main의 대기열을 재처리할 수 있다.
- 매일 09:20 KST에 남은 승인 표식을 다시 처리한다.
- 조직에서 Actions가 차단된 동안에는 위 실행 경로 모두 작동하지 않는다.

## Actions를 사용할 수 없는 경우

작업 트리가 깨끗한 최신 main에서, new-ljm Firestore 접근 자격증명이 있는
관리자 환경으로 실행한다. 미병합 브랜치의 표식을 실행하면 안 된다.

```bash
npm ci
npm --prefix functions ci
bash scripts/publish-ready.sh /tmp/ljm-processed-events
bash scripts/publish-regenerate.sh /tmp/ljm-processed-events
npm --prefix functions run typecheck
npm run lint
npm run build
```

발행 명령은 이미 발행된 사건과 적용된 정정을 중복 처리하지 않는다.
검증 완료 뒤 승인 표식 삭제와 생성된 wiki/sources를 main에 반영한다.
사이트의 홈·archive·사건 상세를 확인하고 App Hosting에서 최신 main의 위키
산출물도 배포됐는지 확인한다. Firestore 발행은 데이터에 즉시 반영된다.
