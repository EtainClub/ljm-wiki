# 이재명 보도 위키

> 같은 사건, 다른 제목

이재명 대통령과 관련 인물의 뉴스를 언론사별로 모은다. 하나의 사건에 각 언론사가
**어떤 제목을 달았는지**, 그리고 **어디가 다루지 않았는지**를 기록한다.
인물들이 언론에 어떻게 등장했는가의 위키가 그 위에 쌓인다.

기록 대상은 **인물이 아니라 보도**다.

- ✗ "정성호는 친명계 핵심 인물이다"
- ✓ "정성호의 사의 표명을 22개 매체가 보도했다"

## 문서

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | **여기서 시작한다.** 무엇이 어디에 있고 언제 움직이는가 — Firestore·저장소·스크립트의 역할, 사건 하나를 기록하는 전체 순서, 배포 |
| [docs/AUTOMATION.md](docs/AUTOMATION.md) | 클라우드 자동 운영 — Hermes Agent 방식, 무에이전트 배치, 인증·검토 관문·실패 처리 |
| [docs/CODEX-SCHEDULED-TASK.md](docs/CODEX-SCHEDULED-TASK.md) | Codex 구독 예약 작업이 승인 대기 PR을 만드는 방법 |
| [docs/YOUTUBE.md](docs/YOUTUBE.md) | YouTube 채널의 명시적 등록·수집 범위와 분석 한계 |
| [docs/DESIGN.md](docs/DESIGN.md) | 왜 이렇게 만들었는가. 실측으로 확인한 것들 (RSS 실태, 네이버 페이지네이션, PWA) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 남아 있는 결함과 마일스톤 |
| [wiki/schema.md](wiki/schema.md) | 위키 기록 규칙. **ingest 전에 반드시 읽는다** |
| [wiki/log.md](wiki/log.md) | ingest 이력. 무엇이 틀렸고 어떻게 고쳤는지 |
| [SETUP.md](SETUP.md) | 처음 설정 |

## 빠른 시작

```bash
npm install && npm --prefix functions install
```

환경변수는 [.env.example](.env.example) 을 `.env.local` 로 복사해 채운다.
실제로 필요한 것은 네이버 검색 API 키 두 개뿐이다. 프로젝트 id 와 도메인은
`.firebaserc` 에서 온다.

```bash
npm run dev
```

배포 서버와 같은 방식으로 확인하려면 `npm run build && npm start`를 쓴다.

## 자주 쓰는 명령

```bash
npm --prefix functions run curate -- list "이재명"
```
수집된 후보 기사를 본다.

```bash
npm --prefix functions run wiki:lint
```
위키의 깨진 링크·평가어·교차참조 어긋남을 검사한다. 고치지는 않는다.

```bash
npm --prefix functions run wiki:outlets
```
매체 페이지와 프레임 군집 페이지를 다시 생성한다.

```bash
npm run deploy
```
비상시 `ljm-wiki` App Hosting 백엔드에 수동 롤아웃한다. 평소에는 실행하지 않는다.
`main`에 병합되면 연결된 GitHub 배포가 자동으로 롤아웃한다.

전체 흐름은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 2절에 순서대로 있다.

## 원칙

**일일 갱신은 승인 대기 PR을 먼저 만든다.** Codex 구독 예약 작업은 사건을 최대 1건
`ready` 상태와 PR로만 만들고, 사용자가 PR을 병합해야 GitHub Actions가 발행·빌드·
App Hosting 롤아웃을 진행한다. 불확실한 사건은 PR도 만들지 않고 건너뛴다.

**브라우저는 Firestore 를 읽지 않는다.** App Hosting 서버만 Admin SDK로 최신 발행
데이터를 읽고, `firestore.rules` 는 전면 deny 다.

**'보도하지 않음' 은 검색어에 달린 값이다.** 실측에서 검색어를 바꾸자 같은 사건·같은
시간창인데 미보도가 6곳에서 0곳이 됐다. 그래서 사건 페이지마다 사용한 검색어를 함께 싣는다.
