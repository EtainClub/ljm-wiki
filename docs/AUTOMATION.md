# 클라우드 자동 운영

이 문서는 수집된 기사에서 사건을 만들고, 보도 범위를 확인하고, 위키와 정적 사이트를
갱신하는 작업을 클라우드에서 반복 실행하는 방법을 정리한다.

기준일 2026-08-04. PR 없이 `main`에 직접 반영하는 GitHub Actions 일일 작업이
`.github/workflows/daily-wiki.yml`에 있다. 이 문서의 Hermes 및 무에이전트 절은 대안과
운영 배경으로 남겨 둔다.

---

## 1. 먼저 알아야 할 현재 경계

현재 자동으로 도는 것은 Cloud Function `collectSources` 하나다. 07·12·18·22시(KST)에
RSS를 읽어 Firestore `items`에 후보 기사를 쌓는다. 이것은 **사건을 만드는 작업이
아니다.**

새 사건 한 건을 사이트에 올리려면 지금은 다음 판단과 실행이 필요하다.

1. `curate list`에서 서로 같은 사건인 기사를 고른다.
2. 사건 제목과 발생 시각을 정해 `curate new`를 실행한다.
3. 요약, 위키 slug, 검색어와 시간창을 정한다.
4. 검색어를 바꿔 가며 `coverage` 결과가 안정적인지 확인한다.
5. 다른 사건 기사를 제외하고 빠진 기사를 붙인다.
6. 기사 제목을 프레임으로 나누고 라벨을 붙인다.
7. `show`로 확인한 뒤 `publish`한다.
8. 원본을 내보내고 사건·인물 위키를 작성한다.
9. 집계 페이지 생성, lint, diff 검토, 빌드, 배포를 한다.

`curate publish`가 검사하는 것은 요약 유무, 보도 건수, 프레임 수와 참조 무결성 같은
구조적 조건이다. 사건 경계, 제목, 발생 시각, 검색어, 프레임의 사실성까지 보증하지는
않는다.

따라서 선택지는 다음 둘이다.

| 방식 | 새 사건 판단 | 장점 | 주의점 |
|---|---|---|---|
| Hermes Agent + 영구 VM | 에이전트가 후보를 읽고 초안을 작성 | 현재 수동 절차에 가장 가깝다 | LLM 비용·오판 가능성, 검토 관문 필요 |
| 무에이전트 배치 | 현재 코드로는 불가능 | 예측 가능하고 저렴하다 | 새 사건 자동 생성을 위한 별도 알고리즘과 CLI가 필요 |

현재 선택한 운영 방식은 GitHub Actions에서 Codex가 하루 최대 사건 1건을 처리하고,
검증 성공 시 `main` 직접 커밋과 Hosting 배포까지 수행하는 것이다. 불확실한 사건은
발행하지 않고 정상적으로 건너뛴다.

---

## 2. 공통 서버 준비

### 실행 환경

- Linux VM 한 대. Hermes를 쓸 때는 gateway와 작업 디렉터리가 유지되는 영구 VM이
  단순하다.
- 전용 최소 권한 사용자 `new-ljm`.
- 저장소 경로 `/srv/new-ljm`.
- Node.js 22, npm, Git, Google Cloud CLI, Firebase CLI.
- 서버 시간대 `Asia/Seoul`.
- 겹치는 실행을 막는 파일 잠금과 실행별 로그.

```bash
sudo timedatectl set-timezone Asia/Seoul
gcloud config set project new-ljm
gcloud config get-value project
```

이후 프로젝트 명령에서는 `GOOGLE_CLOUD_PROJECT=new-ljm`을 매번 붙이지 않아도 된다.
프로그램이 프로젝트를 결정할 때는 `.firebaserc`의 `default: new-ljm`도 사용한다.

### 인증

서버에 개인 계정 로그인이나 장기 서비스 계정 JSON 키를 놓지 않는다.

- Google Compute Engine에서 돌리면 VM에 전용 서비스 계정을 연결하고 최소 IAM 역할만
  부여한다.
- GitHub Actions 같은 외부 CI에서 돌리면 Workload Identity Federation으로 짧은 수명의
  자격증명을 받는다.
- Firebase CLI도 headless/CI 환경에서는 Application Default Credentials(ADC)를
  권장하고 자동으로 감지한다.
- 네이버 검색용 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`은 Secret Manager 또는 서버의
  권한 제한 환경 파일로 주입한다.
- Hermes에는 선택한 모델 공급자의 자격증명이 추가로 필요하다.

운영 계정을 처음부터 하나로 크게 만들지 말고 다음 역할을 나누는 편이 안전하다.

| 실행 주체 | 필요한 범위 |
|---|---|
| 수집 함수 | Firestore의 `sources`, `items` 수집 범위 |
| 큐레이션 잡 | Firestore `items`, `events` 읽기·쓰기 |
| 빌드 잡 | Firestore 발행 사건 읽기 |
| 배포 잡 | Firebase Hosting 배포 |
| Git 작업 | 해당 저장소 branch/PR 생성 |

### 저장소 초기화

```bash
sudo mkdir -p /srv/new-ljm
sudo chown new-ljm:new-ljm /srv/new-ljm
sudo -u new-ljm git clone git@github.com:EtainClub/ljm-wiki.git /srv/new-ljm
cd /srv/new-ljm
npm ci
npm --prefix functions ci
```

작성 시점의 로컬 `main`은 `origin/main`보다 12커밋 앞서 있고 `.github/workflows/`가
없다. 따라서 클라우드 자동화보다 먼저 현재 변경을 검토·커밋하고 원격을 최신 상태로
만들어야 한다. 서버가 오래된 원격을 clone한 채 발행하면 로컬 작업이 빠진다.

---

## 3. 공통 실행 파이프라인

어떤 스케줄러를 쓰더라도 작업 순서는 하나의 상태 기계로 고정한다.

```text
수집 완료 확인
  → 새 후보 확인
  → 중복 사건 확인
  → 사건 초안
  → coverage 검색어 교차검증
  → 기사 제외·추가
  → 프레임 작성
  → show/검증
  → 승인
  → publish
  → export:sources
  → wiki 사건·인물 작성
  → wiki:people / wiki:outlets
  → wiki:lint
  → build
  → deploy
  → 공개 페이지 점검
```

운영 잡은 다음 조건을 지켜야 한다.

- 같은 후보를 두 번 처리해도 사건이 중복 생성되지 않는 idempotency key가 있어야 한다.
- 시작할 때 작업 트리가 깨끗하지 않으면 중단한다.
- `git pull --ff-only`가 실패하면 중단한다.
- 동시 실행을 `flock` 또는 이에 준하는 잠금으로 막는다.
- 후보가 없으면 성공으로 종료하고 모델·네이버 API·배포를 호출하지 않는다.
- 어떤 검증이든 실패하면 `draft`에 머물고 발행·배포하지 않는다.
- 생성된 파일과 Firestore 문서 ID를 실행 로그에 남긴다.
- 허용된 경로 밖의 diff가 생기면 중단한다.
- 배포 후 사건 제목 또는 예상 사건 수를 실제 공개 URL에서 확인한다.

---

## 4. Hermes Agent로 자동화

### 왜 영구 VM인가

Hermes cron은 일반 CLI 프로세스가 아니라 **gateway daemon**이 60초마다 스케줄을
확인해 실행한다. cron 작업은 매번 새 격리 세션에서 시작한다. 프로젝트의
`AGENTS.md`와 작업 디렉터리를 읽게 하려면 cron 생성 시 절대 경로 `--workdir`를
지정한다.

### 설치와 gateway

공식 설치 명령:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes setup
hermes model
hermes tools
sudo hermes gateway install --system
hermes cron status
```

`hermes tools`에서는 cron 작업에 필요한 terminal, file, web 계열만 켜고 delegation,
messaging 같은 불필요한 도구는 끈다. cron 세션에서는 대화형 확인을 할 수 없으므로
skill도 headless 실행을 전제로 작성한다.

서버를 system service로 쓰지 않으면 `hermes gateway`를 직접 계속 실행해야 한다.
gateway가 꺼지면 등록된 cron도 실행되지 않는다.

### 프로젝트 전용 skill

다음 파일은 **새로 만들어야 할 운영 구성**이며 이 저장소에는 아직 없다.

```text
~/.hermes/skills/new-ljm-daily/SKILL.md
```

skill에는 긴 자연어 목표보다 아래와 같은 불변 규칙을 넣는다.

1. `/srv/new-ljm/wiki/schema.md`와 이 문서를 먼저 읽는다.
2. `/srv/new-ljm` 밖의 파일을 수정하지 않는다.
3. dirty worktree, non-fast-forward, 인증 실패이면 즉시 중단한다.
4. `curate list` 결과와 기존 발행 사건을 비교해 중복을 먼저 제거한다.
5. 한 번 실행에서 새 사건을 최대 1건만 처리한다.
6. 사건 발생 시각과 핵심 사실은 원문 또는 서로 독립적인 출처로 확인한다.
7. 최소 3개 검색어 후보의 `coverage`를 비교하고 미보도 집합이 크게 바뀌면 중단한다.
8. `pending`을 0건으로 만들기 전에는 발행하지 않는다.
9. `show`, `wiki:lint`, typecheck, build 중 하나라도 실패하면 발행·배포하지 않는다.
10. 예상한 `sources/`, `wiki/` 경로 외 diff가 생기면 중단한다.
11. 실행 결과, 사건 ID, 중단 이유를 로컬 로그와 알림 채널에 보낸다.
12. 첫 운영 단계에서는 `publish`, `git push`, `npm run deploy`를 실행하지 않고
    초안과 보고서만 남긴다.

### 권장 스케줄

22시 수집 직후보다는 수집이 끝날 시간을 두고 22:30 KST에 실행한다.

```bash
hermes cron create "30 22 * * *" \
  "Run the new-ljm daily ingest skill. Process at most one new event. Stop before publish and deploy unless the repository explicitly enables approved automatic mode." \
  --skill new-ljm-daily \
  --workdir /srv/new-ljm \
  --name new-ljm-daily

hermes cron list
hermes cron run new-ljm-daily
```

알림 채널을 연결했다면 생성 명령에 예를 들어 `--deliver telegram`을 추가할 수 있다.
Hermes cron은 서버의 로컬 시간대를 사용하므로 `date`와 `hermes cron list`의 다음 실행
시각을 함께 확인한다.

cron 대신 외부 스케줄러에서 한 번만 호출하려면 다음 one-shot 형태를 쓸 수 있다.

```bash
cd /srv/new-ljm
hermes -z "Read ~/.hermes/skills/new-ljm-daily/SKILL.md and follow it in draft-only mode."
```

### 비용을 줄이는 pre-check

Hermes cron에는 사전 스크립트가 마지막 줄에 `{"wakeAgent": false}`를 출력하면 LLM을
깨우지 않는 기능이 있다. 다만 현재 저장소에는 “마지막 성공 실행 이후 새 후보 수”를
결정적으로 계산하는 스크립트가 없다. 먼저 그 스크립트를 구현한 뒤
`~/.hermes/scripts/`에 두고 agent cron의 `--script`로 연결한다.

### 권장 운영 단계

1. **관찰 모드** — 후보와 제안만 알림으로 보내고 파일·Firestore를 수정하지 않는다.
2. **초안 모드** — Firestore draft와 로컬 파일 초안까지만 만들고 사람이 검토한다.
3. **PR 모드** — 전용 branch/PR을 만들고 CI가 lint와 build를 검사한다.
4. **승인 발행 모드** — 사람이 승인한 사건만 publish하고 병합 후 배포한다.
5. **제한적 완전 자동** — 검증 임계치를 모두 통과한 사건만 발행하고, 나머지는 draft로
   남긴다.

바로 5단계로 시작하지 않는다.

---

## 5. 에이전트 없이 자동화

### 지금 코드로 안전하게 자동화할 수 있는 것

- 배포된 `collectSources`의 하루 4회 RSS 수집.
- 이미 사람이 발행한 사건에 대한 원본 export와 집계 페이지 재생성.
- `wiki:people`, `wiki:outlets`, `wiki:lint`, typecheck, build.
- 검토·승인된 commit을 Firebase Hosting에 배포.
- 수집 건강 상태와 공개 사이트 점검.

즉 **이미 정의되고 승인된 사건 이후의 기계적 단계**는 shell/systemd, GitHub Actions,
Cloud Run Job 어느 쪽으로도 자동화할 수 있다.

반대로 다음 명령을 단순 cron에 이어 붙여도 새 사건은 생기지 않는다.

```bash
npm --prefix functions run curate -- list "이재명"
npm --prefix functions run wiki:lint
npm --prefix functions run wiki:outlets
npm run deploy
```

`list`는 후보를 출력할 뿐이고 `wiki:*`는 이미 있는 사건을 집계·검사한다. `deploy`는
현재 Firestore와 마크다운으로 정적 사이트를 다시 만들 뿐이다.

### 새 사건까지 무에이전트로 만들려면 필요한 개발

다음 기능은 모두 **제안된 이름이며 현재 존재하지 않는다.**

1. `discover-events`
   - 제목 유사도, 인물, 시간, URL 정규화를 사용해 `items`를 후보 군집으로 묶는다.
   - 기존 사건 coverage 및 `items.eventId`와 대조해 중복을 막는다.
2. `propose-event`
   - 고정 규칙으로 제목, 발생 시각, 검색어 후보, 시간창을 제안한다.
   - 판단할 수 없으면 생성하지 않는 `abstain` 결과를 지원한다.
3. `validate-coverage`
   - 여러 검색어의 결과를 비교하고 페이지네이션이 완주되지 않으면 실패한다.
   - 검색어에 따라 미보도 매체가 크게 바뀌면 사람이 볼 큐로 보낸다.
4. `classify-frames`
   - 고정된 프레임 분류표 또는 재현 가능한 모델을 사용한다.
   - 라벨 신뢰도가 낮거나 미배정 기사가 있으면 발행하지 않는다.
5. `render-wiki-event`
   - 자유 서술 대신 출처가 붙은 고정 템플릿으로 사건·인물 페이지를 만든다.
6. `automation:daily`
   - 위 단계를 상태 기계로 묶고 잠금, 재시도, 실행 ID, dry-run을 제공한다.
7. 자동화 상태 저장
   - `candidateHash`, `automationRunId`, `reviewStatus`, `lastError`,
     `approvedAt`, `approvedBy`를 기록한다.

프레임과 위키 문장을 완전히 결정적인 규칙으로 만들 수 없다면 무에이전트 완전 자동
발행 대신 “후보 생성 → 사람 승인”을 최종 형태로 삼는다.

### 실행 플랫폼 선택

| 플랫폼 | 적합한 경우 | 주의점 |
|---|---|---|
| GCE + systemd timer | 저장소 clone과 상태를 계속 유지 | OS 패치, 디스크, daemon 운영 필요 |
| Cloud Run Job + Cloud Scheduler | 컨테이너가 실행 후 종료되는 결정적 배치 | 로컬 상태가 사라지므로 결과를 Firestore/Git에 저장해야 함 |
| GitHub Actions schedule | branch, commit, PR, CI가 중심 | Google 인증은 WIF, GitHub 권한과 비공개 기록 노출 검토 필요 |
| Hermes `--no-agent` cron | 이미 완성된 shell/Python 배치를 Hermes gateway로 통합 | Hermes는 스케줄러 역할만 하며 사건 판단은 하지 않음 |

무에이전트 배치 자체는 Cloud Run Job + Cloud Scheduler가 자연스럽다. Cloud Run Job은
요청을 받는 서버가 아니라 작업을 실행하고 종료하며 timeout과 retry를 설정할 수 있다.
다만 저장소 파일을 고쳐 PR을 만드는 것이 핵심이면 GitHub Actions가 더 단순하다.

Hermes를 설치했지만 LLM은 전혀 쓰고 싶지 않은 경우에는 완성된 배치 스크립트를
`~/.hermes/scripts/`에 두고 다음처럼 등록할 수 있다.

```bash
hermes cron create "30 22 * * *" \
  --no-agent \
  --script new-ljm-daily.sh \
  --deliver telegram \
  --name new-ljm-daily-no-agent
```

이 예시의 `new-ljm-daily.sh`는 아직 구현해야 한다. no-agent job은 stdout을 그대로
전달하고, 빈 stdout은 알림 없이 끝나며, non-zero exit 또는 timeout은 오류로 알린다.

---

## 6. 검토 관문을 자동화 구조에 맞게 고쳐야 한다

현재 `events.status`는 `draft | published`뿐이다. 또한 `wiki:outlets`과 정적 빌드는
발행 사건만 읽는다. 이 구조에서 PR을 만들기 위해 먼저 `publish`하면 Firestore는 사람의
승인 전에 발행 상태가 되고, `publish`하지 않으면 최종 산출물을 온전히 미리 볼 수 없다.

안전한 자동화를 위해 다음 중 하나를 먼저 구현한다.

### 권장안: `ready` 상태 추가

```text
draft → ready → approved → published
```

- `curate prepare`: 구조 검증 후 `ready`.
- preview build: `ready` 사건까지 포함하되 운영 URL에는 배포하지 않는다.
- PR 승인 또는 명시적 승인 명령: `approvedAt`, `approvedBy` 기록.
- 배포 잡: 승인된 사건만 `published`로 전환하고 export, 집계, build, deploy.

### 최소 변경안

- `wiki:people`, `wiki:outlets`, build에 `--include-draft <event-id>` preview 옵션을 추가한다.
- PR에서는 특정 draft 하나를 포함한 결과만 검사한다.
- 병합 후 별도 잡이 `publish`와 운영 배포를 실행한다.

둘 중 하나가 없으면 Hermes 자동화는 **draft 생성과 보고까지만** 허용하는 것이 맞다.

---

## 7. 실패 처리와 모니터링

### 공통

- 매 실행에 시작·종료 시각, git commit, 사건 ID, 명령별 exit code를 남긴다.
- 정상 종료, 후보 없음, 검토 필요, 실패를 서로 다른 상태로 기록한다.
- 실패 시 다음 실행이 같은 사건을 새로 만들지 않고 기존 draft에서 재개해야 한다.
- Firestore 쓰기 뒤 파일 생성이 실패했는지, 파일 생성 뒤 배포가 실패했는지 구분한다.
- 자동 수정으로 실패를 숨기지 말고 draft와 로그를 보존한다.

### Hermes

```bash
hermes cron status
hermes cron list
hermes cron runs new-ljm-daily --limit 20
hermes logs
```

세부 로그는 `~/.hermes/logs/agent.log`, 경고는 `~/.hermes/logs/errors.log`에서 확인한다.
gateway 중복 실행은 lock 경합과 지연을 만들 수 있으므로 하나만 실행한다.

### 공개 확인

배포가 성공해도 다음을 별도로 확인한다.

- `https://new-ljm.web.app`이 200을 반환하는가.
- 새 사건 제목과 날짜가 색인에 보이는가.
- 사건 페이지의 매체 수와 프레임 수가 `curate show` 결과와 같은가.
- 위키 링크가 모두 정적 페이지로 열리는가.

검사 실패 시 추가 배포를 멈추고 마지막 정상 Firebase Hosting release로 되돌린다.
현재 `curate delete`는 발행 사건 삭제를 거부하므로 잘못 발행한 사건을 자동 삭제하는
방식을 rollback으로 삼지 않는다. 정정 절차를 별도로 둔다.

---

## 8. 권장 구현 순서

1. 현재 로컬 변경을 검토·커밋·push해 서버가 같은 `main`을 보게 한다.
2. 전용 서비스 계정, ADC, Secret Manager, 서버 시간대를 설정한다.
3. idempotency key, 실행 로그, lock이 있는 `automation:daily --dry-run`을 구현한다.
4. `ready`/승인 상태 또는 draft preview 기능을 구현한다.
5. CI에 `wiki:lint`, 양쪽 typecheck, lint, 실제 Firestore build 검사를 넣는다.
6. Hermes 관찰 모드로 7일 이상 실행해 후보 누락·중복·검색어 변동을 기록한다.
7. 초안/PR 모드로 전환한다.
8. 사람이 승인한 사건의 병합 후 배포만 자동화한다.
9. 충분한 운영 기록이 쌓인 뒤 제한적 완전 자동 발행 여부를 결정한다.

---

## 9. 운영 체크리스트

- [ ] 서버 시간대가 `Asia/Seoul`이다.
- [ ] `gcloud config get-value project`가 `new-ljm`이다.
- [ ] ADC로 Firestore 실제 사건을 읽는다.
- [ ] 네이버 API 비밀이 저장소와 로그에 나오지 않는다.
- [ ] `main`이 원격과 동기화되어 있다.
- [ ] dirty worktree에서 잡이 중단된다.
- [ ] 동시 실행 잠금이 있다.
- [ ] 후보 없음은 성공·무배포로 끝난다.
- [ ] 중복 사건 방지 키가 있다.
- [ ] 검색어 변동이 크면 자동 발행하지 않는다.
- [ ] `wiki:lint`, typecheck, build가 모두 통과해야 한다.
- [ ] 사람 승인 전 운영 배포가 일어나지 않는다.
- [ ] 배포 후 공개 URL을 검사한다.
- [ ] 실패·정정·Hosting rollback 절차를 시험했다.

---

## 공식 참고 문서

- [Hermes Agent 설치와 기본 명령](https://github.com/NousResearch/hermes-agent)
- [Hermes Scheduled Tasks](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/cron.md)
- [Hermes CLI — one-shot `hermes -z`](https://github.com/nousresearch/hermes-agent/blob/main/website/docs/reference/cli-commands.md)
- [Hermes cron 문제 해결](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/guides/cron-troubleshooting.md)
- [Firebase CLI의 CI 인증](https://firebase.google.com/docs/cli)
- [Cloud Run Job](https://cloud.google.com/run/docs/create-jobs)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs/tut-gcf-http)
- [배포 파이프라인용 Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
