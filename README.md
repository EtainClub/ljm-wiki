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
npm run build && npm run serve:out
```

> ⚠ `npm run dev` 로는 위키 페이지(`/w`)를 볼 수 없다. 한글 경로를
> `generateStaticParams()` 와 대조하지 못해 실패한다. 빌드 후 정적 서버로 띄운다.

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
빌드 후 Firebase Hosting 에 올린다.

전체 흐름은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 2절에 순서대로 있다.

## 원칙

**커밋은 항상 사람이 한다.** 실존 인물·매체에 대한 기록이므로, 사람이 눈으로 보지
않은 문장이 발행되면 안 된다. `git diff` 가 유일한 검토 관문이다.

**브라우저는 Firestore 를 읽지 않는다.** 정적 export 이고, 데이터는 빌드 시
Admin SDK 로 읽어 HTML 에 구워 넣는다. `firestore.rules` 는 전면 deny 다.

**'보도하지 않음' 은 검색어에 달린 값이다.** 실측에서 검색어를 바꾸자 같은 사건·같은
시간창인데 미보도가 6곳에서 0곳이 됐다. 그래서 사건 페이지마다 사용한 검색어를 함께 싣는다.
