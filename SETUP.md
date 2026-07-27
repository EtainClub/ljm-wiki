# 설정

프로젝트: **new-ljm** (asia-northeast3, Blaze)

## 1. Firestore 켜기 — ⚠ 직접 하셔야 합니다

에이전트 환경이 `gcloud` 같은 클라우드 인프라 CLI를 차단하고 있어 API 활성화를 대신 못 합니다. 둘 중 아무거나:

```bash
gcloud services enable firestore.googleapis.com --project new-ljm
```

또는 콘솔에서 한 번 누르기 —
<https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=new-ljm>

활성화가 전파되는 데 1~2분 걸립니다. 그다음은 제가 이어서 합니다:

```bash
firebase firestore:databases:create "(default)" --location asia-northeast3 --project new-ljm
firebase deploy --only firestore:rules,firestore:indexes
npm --prefix functions run seed
```

## 2. 자격증명

로컬은 이미 gcloud ADC가 있어 추가 설정이 필요 없습니다. 없다면:

```bash
gcloud auth application-default login
```

**서비스 계정 키 파일은 필요하면 직접 발급하세요** (Firebase 콘솔 → 프로젝트 설정 → 서비스 계정). 저장소에 넣지 마세요 — `.gitignore`가 `.env*`를 막고 있습니다.

## 3. `.env.local` 정리 필요

지금 들어 있는 값은 **이전 프로젝트(undrift)의 클라이언트 SDK 설정 그대로**입니다. 이 제품에는 하나도 쓰이지 않습니다:

| 지금 있는 것 | v1에서 쓰나 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` 외 클라이언트 SDK 일체 | ✗ 브라우저가 Firestore를 안 씁니다 |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | ✗ 푸시는 v1 비범위 |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_*` | ✗ 클라이언트 접근이 없어 App Check 대상이 없음 |
| `NEXT_PUBLIC_DATA_MODE` | ✗ 이전 앱의 mock/firebase 전환 스위치 |

`.env.local.example`이 이 프로젝트에 실제로 필요한 것만 담고 있습니다. 그걸 기준으로 다시 만드시면 됩니다.

남겨야 할 것은 사실상 `FIREBASE_PROJECT_ID`와, 나중에 `NAVER_CLIENT_ID/SECRET`·`YOUTUBE_API_KEY`뿐입니다.

## 4. 외부 API 키 (나중에)

- **네이버 검색 API** — 사건별 '보도 여부 확인'에 필요합니다. RSS가 없는 8곳(중앙일보·한겨레·한국일보·문화일보·KBS·MBC·YTN·뉴스1)은 이것 없이는 확인이 안 됩니다. 개발자센터에서 등록, 일 25,000건 무료.
- **YouTube Data API v3** — 유튜브 채널을 추가할 때만.

배포본은 Secret Manager를 씁니다:

```bash
firebase functions:secrets:set NAVER_CLIENT_ID
```

## 5. 확인용 명령

Firebase 없이 지금 수집이 되는지 보는 드라이런:

```bash
npm --prefix functions run collect:dry
```

프런트 빌드:

```bash
npm run build
```

## 6. 함수 배포가 403 으로 실패할 때 — ⚠ 직접 하셔야 합니다

첫 함수 배포에서 이 에러가 난다:

```
Could not create Cloud Run service collectsources.
Permission 'iam.serviceaccounts.actAs' denied on service account
<번호>-compute@developer.gserviceaccount.com (or it may not exist).
```

**원인은 Compute Engine API 가 꺼져 있는 것이다.** 메시지가 권한 이야기를 하지만
실제로는 뒤쪽 괄호 — "or it may not exist" — 가 맞다.

Cloud Functions v2 는 Cloud Run 위에서 돌고, 런타임 서비스 계정으로
기본 compute 서비스 계정을 쓴다. 이 계정은 IAM 목록에는 보이지만
Compute Engine API 가 켜져 있어야 실제로 쓸 수 있다. Firebase 프로젝트를
만들 때 이 API 는 자동으로 켜지지 않는다.

배포하는 사람이 Owner 여도 난다 — 권한 문제가 아니기 때문이다.

```bash
gcloud services enable compute.googleapis.com --project=new-ljm
```

VM 이 만들어지지 않으므로 이것만으로 요금이 붙지 않는다.
1~2분 기다렸다가 다시 배포한다.

```bash
npm --prefix functions run deploy
```

**막히기 전에 확인하려면** — 아래 명령의 결과에 `compute.googleapis.com` 이 있어야 한다.

```bash
gcloud services list --enabled --project=new-ljm | grep compute
```

런타임 계정의 역할도 함께 본다. `roles/editor` 가 없으면 배포는 되고 실행이 실패한다.

```bash
gcloud projects get-iam-policy new-ljm --flatten="bindings[].members" --format="table(bindings.members,bindings.role)" --filter="bindings.members:compute"
```
