# 서로 충돌하지 않는 뉴스 승인 PR

사건 승인 PR의 입력과 공통 산출물을 분리한다. 이 문서는 기존 큐레이션 문서의
색인·이력·인물 파일 직접 편집 절차보다 우선한다.

## 충돌 원인

기존 PR은 같은 main에서 분기한 뒤 모두 아래 위치를 바꿨다.

- `wiki/index.md`: 사건·원본 수와 사건 표 첫 행
- `wiki/log.md`: 같은 제목 바로 아래 ingest 이력
- `wiki/people/이재명.md` 등: 같은 생성 구간 첫 행

첫 PR 병합 후 두 번째 PR은 같은 줄을 다른 값으로 바꿔 Git 충돌을 일으켰다.
추가로 발행 봇이 인물 집계를 다시 생성해 아직 열린 PR의 수동 집계와 충돌했다.
workflow concurrency는 봇 실행만 직렬화하므로 PR 사이의 충돌은 해결하지 못한다.
매번 main을 병합하는 것은 일시적 복구이고 다음 병합에서 다시 발생한다.

## PR에 넣는 파일

1. `sources/YYYY-MM-DD/<매체>-<항목>.md`: 불변 원제·시각·URL
2. `wiki/events/<wikiSlug>.md`: 해당 사건의 관찰·프레임·인물·한계
3. `.automation/ready-events/<eventId>.json`: 발행 승인 표식
4. `.automation/ingest-records/<eventId>.json`: 해당 사건의 이력과 등장 인물

`ready` 후 `queue:approval -- <eventId>`가 3·4를 함께 만든다. 사건 위키에는
`- **집계** ...` 줄과 `[[people/이름]]` 링크를 넣는다. 새 인물도 사건 위키에 링크만
적고 공통 인물 파일은 PR에서 만들지 않는다. queue가 인물 목록을 record에 저장한다.
record의 `log`는 필요하면 출처 링크를 붙여 사건별로 보완할 수 있다.

`wiki/index.md`, `wiki/log.md`, `wiki/people/*`, `wiki/outlets/*`, `wiki/프레임-군집.md`를
승인 PR에서 수정하지 않는다. 인물에 관한 추가 관찰은 사건 페이지에 적는다.
새 인물의 기본 별칭은 이름이며 별칭의 추가 판단은 별도 관리 변경으로 검토한다.

## 검증과 발행

```bash
npm --prefix functions run -s curate -- ready EVENT_ID
npm --prefix functions run -s queue:approval -- EVENT_ID
npm --prefix functions run -s wiki:lint
npm --prefix functions run -s typecheck
npx tsc --noEmit
npm run -s lint
npm run -s build
# 커밋 후 PR diff의 소유권 검사
node scripts/check-curation-pr.mjs origin/main HEAD
```

위키 lint는 실제 승인 표식과 사건별 record가 있는 새 사건에만 역링크·새 인물 생성의
지연을 허용한다. `.github/workflows/curation-pr.yml`은 공통 파일 변경 또는 누락된
record를 거부한다. GitHub에서 이 검사를 필수 status check로 설정하면 실패한 PR의
병합도 막을 수 있다. 기본 PR 검사가 성공했다고 사람이 작성한 공통 파일을 없애지는 않는다.

사용자가 PR을 병합하면 기존 publish workflow가 발행하고 최신 main 위에서 다음을 생성한다.

1. `wiki:catalog`: record에서 새 인물 기본 페이지·사건 색인·실제 파일 수·ingest 이력 생성
2. `wiki:people`: 발행 사건에서 인물 목록·상호 집계 생성
3. `wiki:outlets`, `wiki:lint`, 타입 검사·린트·빌드

생성은 재실행 가능하며 이력·기존 인물의 수동 설명·과거 색인 행을 보존한다.
봇 push가 경합하면 최신 main에서 파일만 다시 생성하고 Firestore 발행은 반복하지 않는다.
같은 사건을 동시에 고치는 PR과 코드 자체를 동시에 수정하는 PR의 의미적 충돌은 여전히
사람의 판단이 필요하다. 서로 다른 사건 등록은 공통 파일을 쓰지 않아 이 충돌 경로가 없다.

## 이미 열려 있는 PR 전환

사건별 이력을 record에 옮긴 후 공통 파일만 최신 main과 동일하게 맞춘다.
원본·사건 페이지·승인 marker는 유지하고 새 record를 커밋한다. main을 한 번 합쳐 현재
충돌을 정리한 다음부터는 다른 사건의 병합으로 인한 공통 파일 충돌이 재발하지 않는다.
공통 인물 페이지의 추가 관찰은 사건 페이지로 옮겨 보존한다.

구조 변경 PR을 먼저 병합하고 전환된 뉴스 PR을 병합한다. 전환된 PR은 새 generator가
있는 main에 병합해야 색인·이력이 생성된다. Git 병합 순서를 양쪽으로 바꾸고 중간에 봇의
공통 산출물 커밋을 끼우는 회귀 테스트는 `npm --prefix functions run test:curation`으로 실행한다.
