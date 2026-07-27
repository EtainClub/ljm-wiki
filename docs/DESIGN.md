# 같은 사건, 다른 제목 — MVP 설계

> 하나의 사건에 대해 언론·유튜브 채널이 **어떤 제목을 달았는지**, 그리고 **어디가 다루지 않았는지**를 하루 한 페이지로 보여준다.

이 문서는 **어떻게 만들었는가**를 적는다.
아직 안 된 것과 다음에 할 일은 [ROADMAP.md](ROADMAP.md) 에 있다.

---

## 0. 설계 전제

| 항목 | 결정 | 근거 |
|---|---|---|
| 호스팅 | Firebase Hosting (정적) | App Hosting 미사용 지시. 일반 Hosting의 Next.js 프레임워크 지원은 신규 참여 중단됨 |
| 렌더링 | `output: "export"` — 전량 SSG | 위 제약. 하루 1~3건 발행이라 SSR 불필요 |
| 백엔드 | Cloud Functions + Firestore | 수집·분류·발행 트리거 |
| 콘텐츠 갱신 | **발행 = 재빌드 + 재배포** | 정적 export의 필연. 하루 4~6회 빌드로 충분 |
| 클라이언트 DB 접근 | **없음** | v1은 로그인·기여 없음 → Firestore는 Admin SDK 전용, rules 전면 deny |
| 저장 대상 | **제목 + 링크 + 매체명만** | 본문 저장은 저작권 위험. 기사 제목은 저작물성이 낮음 |

핵심 결과: **공개 웹앱은 순수 정적 HTML/PNG 덩어리**다. 공격 표면이 거의 없고, CDN 캐시만으로 트래픽 급증을 견딘다.

---

## 1. 아키텍처

```
 [Cloud Scheduler]  4회/일
        │
        ▼
 [Function: collect]  ──▶ 언론 RSS · 네이버 검색 API · YouTube Data API
        │                 (제목/URL/게시시각만)
        ▼
   Firestore: items/          원자료
        │
        ▼
 [로컬 CLI: curate]   사람이 사건 생성 · 후보 item 배정
        │
        ▼
 [Function: draftFrames]  Claude API → 프레임 분류 초안
        │
        ▼
 [로컬 CLI: publish]  사람이 검수 → events.status = "published"
        │
        ▼
 [Function: onPublish]  ──▶ GitHub Actions repository_dispatch
                                  │
                                  ▼
                          next build (Admin SDK로 Firestore 읽기)
                                  │
                                  ▼
                          firebase deploy --only hosting
```

빌드 타임에 Server Component가 Firestore를 직접 읽는다. 정적 export에서 Server Component는 `next build` 중 실행되므로 그대로 동작한다.

---

## 2. Firestore 데이터 모델

### `sources/{sourceId}` — 매체·채널 마스터

```ts
{
  id: string            // "khan" | "yt_UCxxxxxxxx"
  name: string          // "경향신문"
  type: "press" | "youtube"
  platform: "web" | "youtube"
  rssUrl?: string
  channelId?: string    // YouTube
  uploadsPlaylistId?: string
  homepage: string
  active: boolean
  displayOrder: number
  addedAt: Timestamp
}
```

**의도적으로 없는 필드: 성향·진영·등급 라벨.**
매체에 고정 라벨을 박는 순간 그 자체가 낙인이 되고, 편향 공격의 표적이 된다. 분류는 **사건 단위로만** 한다.

### `items/{itemId}` — 수집 원자료

```ts
{
  sourceId: string
  title: string              // 수집 시점 원문 그대로
  titleHistory: Array<{ title: string; observedAt: Timestamp }>
  url: string
  publishedAt: Timestamp
  collectedAt: Timestamp
  kind: "article" | "video"
  eventId: string | null     // 사건 배정 시
  frameKey: string | null    // 사건 내 프레임
  status: "live" | "title_changed" | "removed"
  lastCheckedAt: Timestamp
}
```

`titleHistory`가 부가 킬러 기능이다. **"이 기사는 게시 3시간 뒤 제목을 바꿨다"** 는 100% 사실이고, 아무도 추적하지 않으며, 공유 가치가 매우 높다.

### `events/{eventId}` — 사건

```ts
{
  slug: string               // "2026-07-26-abc"
  date: string               // "2026-07-26" (KST)
  title: string              // 편집자 작성, 중립 서술
  summary: string            // 2~3문장
  occurredAt: Timestamp      // 시간차 계산 기준점
  frames: Array<{
    key: string              // "achievement" | "concern" | ...
    label: string            // "'성과'로 다룸"
    note?: string            // 분류 근거 한 줄
    itemIds: string[]
  }>
  coverage: {                // 고정 목록 전체에 대한 보도 여부
    [sourceId: string]: {
      status: "covered" | "none"
      checkedAt: Timestamp
      itemId?: string
      delayMinutes?: number  // occurredAt 대비 보도 지연
    }
  }
  status: "draft" | "review" | "published"
  publishedAt: Timestamp | null
  lastRecheckAt: Timestamp
  recheckCount: number
  editorNote?: string
}
```

**`coverage`가 "보도하지 않음" 칸의 근거다.** 이건 사실 주장이므로 `checkedAt`을 반드시 화면에 표기한다 → "2026-07-26 21:00 기준".

**사후 보도 처리**: 발행 후 `+6h / +12h / +24h / +48h` 시점에 재확인하고 재빌드한다. 나중에 보도하면 `none` → `covered` + `delayMinutes`로 전환된다. 미보도가 지연 보도로 바뀌는 건 데이터가 **더 강해지는** 것이므로 반드시 구현한다.

### `buildJobs/{jobId}` — 배포 추적

```ts
{ trigger: "publish" | "recheck" | "manual", eventId?, requestedAt, dispatchedAt, status }
```

---

## 3. 수집기 설계 (`Function: collect`)

Cloud Scheduler로 하루 4회 (07:00 / 12:00 / 18:00 / 22:00 KST).

### 두 가지 일을 구분한다 (구현하며 확정)
처음에는 "RSS로 모으고 없으면 네이버로 보완"으로 잡았는데, 만들면서 이게 하나의 일이 아니라는 게 드러났다. 네이버 검색은 **질의어를 요구하므로 사건이 정해지기 전에는 쓸 수 없다.**

| | 발굴(discovery) | 보도 여부 확인(coverage) |
|---|---|---|
| 언제 | 상시, 하루 4회 | 사건이 정해진 뒤 |
| 무엇 | 매체별 최신 기사 → 후보 풀 | "이 매체가 **이 사건**을 다뤘나" |
| 수단 | RSS | 네이버 검색 (도메인으로 매체 판별) |
| 목적 | 사람이 사건을 고를 재료 | `coverage` 맵 채우기 |

RSS가 있는 매체도 **보도 여부 확인에는 네이버를 함께 쓴다.** RSS가 전체 기사를 담지 않는 경우가 있어 '보도하지 않음'을 잘못 찍을 위험이 있기 때문이다. 이 표시는 사실 주장이므로 틀리면 안 된다.

### 검색 한 번으로는 '보도하지 않음'을 판정할 수 없다 (실측)
처음에는 검색 1회(`display=100`)로 모든 매체를 한꺼번에 판정하도록 만들었다. 실제로 돌려 보니 **같은 사건·같은 시간창인데 질의어를 바꾸자 판정이 뒤집혔다.**

| 매체 | "정성호 사의" | "정성호 법무부 장관 사의 표명" |
|---|---|---|
| 서울신문 | 보도함 | 보도하지 않음 |
| 프레시안 | 보도하지 않음 | 보도함 |

원인: 결과 100건 중 **62건이 관찰 목록 밖 매체**였다. 우리 25곳에 남은 자리는 38개뿐이라 실제로 보도한 매체가 잘려 나갔다.

**수정**: `sort=date`가 최신순이라는 성질을 이용해 `since`를 지날 때까지 페이지를 넘긴다(최대 10회 × 100건). 시간창을 다 훑지 못하면 `truncated`로 알리고, 그 상태의 판정은 쓰지 않는다.

수정 후 같은 사건이 **미보도 6곳 → 0곳**으로 바뀌었다. 6곳 전부 실제로는 보도했던 것이다. 페이지네이션 없이 발행했다면 **사이트의 핵심 주장이 통째로 틀렸을 것이다.** 호출은 사건당 2~4회로, 일 25,000회 한도에 여유가 크다.

**남은 한계**: 질의어 선택은 여전히 재현율에 영향을 준다. 다른 표현으로 보도한 매체는 놓칠 수 있다. `/method`의 한계 절에 이 점을 명시해야 한다.

### 국내 RSS 실태 (2026-07-26 실측)
25곳을 찔러 본 결과 **17곳만 발굴에 쓸 수 있었다.** 지어낸 주소로 시작했다면 절반이 조용히 빈 결과를 냈을 것이다.

| 현상 | 사례 | 대응 |
|---|---|---|
| 일시 실패 | 연합뉴스 1차 실패 → 2차 120건 | 지수 백오프 재시도 3회 |
| RSS 폐지 | 중앙일보가 "서비스 종료 안내" HTML을 200으로 반환 | HTML 감지 → 명시적 실패 → 네이버 전략 |
| TLS 협상 실패 | 이데일리 https 불가, http는 정상 | TLS 오류일 때만 http 폴백 (공개 피드 읽기, 자격증명 없음) |
| EUC-KR | 국민일보 | Content-Type → XML 선언 순으로 charset 판별 후 디코딩 |
| `pubDate` 부재 | 한겨레 (제목·링크는 있음) | 게시 시각이 없으면 보도 지연을 못 잰다 → 네이버 전략 |
| CDATA 안 엔티티 | 머니투데이 `&quot;` | XML 파서가 안 푼다. 파싱 후 별도 디코딩 |
| 앰퍼샌드 유실 | 프레시안 `hellip;` `middot;` | 활자 기호 한정 복원 (매체가 단 제목은 `…`이 맞다) |
| 경로에 추적 조각 | 프레시안 `...844&ref=rss` | 떼도 같은 기사가 열리는 것 확인 후 제거 |
| **정체된 피드** | **JTBC 뉴스속보 — 2024-10-29에서 멈춤** | **아래 참조** |

### 가장 위험한 실패 유형: 정체된 피드
JTBC 뉴스속보 피드는 200과 **유효한 RSS 21건**을 계속 돌려준다. fetch도 파싱도 성공하므로 실패로 잡히지 않는다. 그런데 항목이 전부 **21개월 전** 것이라 신선도 필터(48시간)에서 전량 탈락한다 — 즉 **정상으로 보이면서 발굴에 0건 기여**한다.

드라이런에서는 20건이 나왔는데 실제 적재는 0건이었다. **실제로 넣어 보기 전까지 발견할 수 없는 종류의 실패다.**

대응: `health`에 `consecutiveEmpty`와 `lastFreshAt`을 추가해 "성공했지만 신선한 항목 0건"을 실패와 별도로 센다. 수집 요약에도 `stale[]`로 올라오고, 스케줄 함수가 별도 경고를 남긴다.

**저장은 `title`, `url`, `publishedAt`, `sourceId`만.** 본문은 읽지도 저장하지도 않는다.

**피드는 예고 없이 죽는다.** `sources/{id}.health`에 연속 실패를 기록하고, `npm --prefix functions run collect:dry`로 Firestore 없이 지금 상태를 확인할 수 있게 해 뒀다.

### YouTube
**`search.list`를 쓰지 말 것.** 호출당 100 units라 일일 쿼터 10,000을 즉시 소진한다.
채널별 `uploads` 플레이리스트를 `playlistItems.list`(1 unit)로 순회한다.

```
채널 50개 × 4회/일 = 200 units/일   (쿼터 10,000의 2%)
```

`uploadsPlaylistId`는 최초 1회 `channels.list`로 확보해 `sources`에 캐시한다.

### 제목 변경 감지
기존 `items`를 하루 2회 재조회해 `title`이 바뀌면 `titleHistory`에 append하고 `status`를 갱신한다.

### v1 제외
X / Threads. API 비용이 크고, 계정 단위 데이터는 개인정보·명예훼손 노출이 훨씬 크다. 유튜브+언론만으로 MVP 가설은 검증된다.

---

## 4. 프레임 분류

1. `draftFrames` Function이 사건에 배정된 item 제목 목록을 Claude API에 전달 → 프레임 2~4개 제안 + 각 item 배정.
2. 결과는 `status: "draft"`로만 저장. **자동 발행 금지.**
3. 사람이 CLI에서 검수·수정 후 `published`.

### 분류 규칙
- 입력은 **제목만**. 본문을 넣지 않는다 (저작권 + 비용 + 환각).
- 프레임 라벨은 서술형("'우려'를 앞세움")으로 쓰고, 평가어("왜곡", "악의적")를 쓰지 않는다.
- 어느 프레임에도 안 맞으면 "기타"로 두고 억지 배정하지 않는다.
- 분류 기준 전문은 `/method` 페이지에 공개한다. 이게 편향 시비에 대한 유일한 방어다.

---

## 5. 프론트엔드 (App Router, static export)

```
src/app/
  layout.tsx                    metadataBase, PWA 메타, 헤더/하단탭
  page.tsx                      오늘의 사건
  e/[slug]/page.tsx             사건 상세  ← 공유 타겟
  e/[slug]/card.png/route.ts    세로형 공유 카드 (1080×1350)
  e/[slug]/og.png/route.ts      OG 이미지 (1200×630)
  archive/page.tsx              지난 사건
  sources/page.tsx              수집 매체 전체 공개
  method/page.tsx               방법론·분류 기준·한계
  offline/page.tsx              SW 오프라인 대체 화면
  manifest.ts                   PWA manifest
  icon-192.png / icon-512.png / icon-maskable-512.png / apple-icon-180.png
  feed.json/route.ts            정적 JSON (예정)
  sitemap.ts / robots.ts        (예정)
```

정적 export의 라우트 규칙 두 가지 — 어기면 빌드가 죽는다.
- 동적 세그먼트가 있는 라우트: `generateStaticParams()` + `dynamicParams = false`
- **파라미터 없는 route handler: `export const dynamic = "force-static"`** (아이콘 라우트에서 실제로 빌드가 실패했다)

### PWA 셸
홈 화면에 설치해 쓰는 형태를 전제로 한다.

- **하단 탭 4개**: 오늘 / 지난 / 매체 / 방법. 사건 상세(`/e/...`)는 탭이 아니라 '오늘'의 하위 화면으로 취급해 '오늘'을 활성으로 둔다
- `viewportFit: "cover"` + `env(safe-area-inset-*)` 로 노치·홈 인디케이터 처리
- **서비스 워커는 직접 쓴다.** Serwist 류는 webpack 설정을 요구하는데 이 프로젝트는 Turbopack 이다. 전략은 두 가지뿐이라 직접 쓰는 편이 단순하다
  - 문서: 네트워크 우선 (사건 내용이 매일 바뀌므로 캐시 우선은 안 된다)
  - `/_next/static/`: 캐시 우선 (파일명에 해시가 있다)
- **푸시 알림은 v1 범위 밖.** 정적 export 에는 Server Action 이 없어 별도 API 가 필요하다
- 아이콘은 빌드 시 `ImageResponse` 로 생성한다. 글자를 넣지 않아 폰트 로딩이 필요 없다

### 사건 상세 화면 구조

```
┌─────────────────────────────────────┐
│ 2026-07-26 · ○○ 정책 발표           │
│ 요약 2~3문장                         │
├─────────────────────────────────────┤
│ ■ '성과'로 다룸 (11)                 │
│   경향신문  「제목 원문…」    12:04   │
│   …                                  │
│ ■ '논란·우려'로 다룸 (8)             │
│   …                                  │
│ ■ 보도하지 않음 (14)                 │
│   매체E  매체F  매체G …              │
│   ※ 7/26 21:00 기준                  │
│ ■ 제목을 수정함 (2)          ← 있으면 │
│   매체H  「원제목」→「현재 제목」      │
├─────────────────────────────────────┤
│ [이미지로 저장]  [링크 복사]          │
└─────────────────────────────────────┘
```

- 모든 제목은 **원문 링크가 걸린 인용**이다. 요약·재서술하지 않는다.
- 정렬은 보도 시각순. 매체 순서를 편집자가 임의로 못 바꾸게 한다.
- 카운트를 크게 노출한다. 숫자가 공유를 만든다.

---

## 6. OG 이미지

두 종류를 빌드 시 PNG로 뽑는다. 둘 다 `ImageResponse`(satori)를 쓰고 폰트 로더를 공유한다.

| 자산 | 경로 | 크기 | 용도 |
|---|---|---|---|
| 공유 카드 | `app/e/[slug]/card.png/route.ts` | 1080×1350 | 카톡·커뮤니티에 이미지로 붙이는 것. **실질 공유 엔진** |
| OG 이미지 | `app/e/[slug]/og.png/route.ts` | 1200×630 | 링크 미리보기 |

**`opengraph-image.tsx` 규약을 쓰지 않는다.** 규약을 쓰면 `out/`에 확장자 없는 `opengraph-image` 파일이 떨어지는데, 정적 파일 서버는 확장자로 Content-Type을 정하므로 `image/png`로 나가지 않고 크롤러가 거부한다. 대신 `og.png/route.ts`로 직접 뽑고 `generateMetadata`에서 `openGraph.images`를 명시한다.

정적 export에서 Route Handler는 빌드 시 파일로 떨어진다(GET만 가능). 따라서 클라이언트 canvas가 필요 없고, "이미지로 저장" 버튼은 이 PNG를 가리키는 `<a download>` 하나면 된다.

### 반드시 챙길 것
1. **한글 폰트.** satori에 한글이 없고 `.ttc`는 읽지 못한다. `assets/fonts/`에 Pretendard Regular/Bold(OFL, 각 ~1.5MB)를 넣고 `readFile(join(process.cwd(), ...))`로 주입한다. 안 하면 전부 두부(□)로 나온다. **Bold가 없으면 굵기 대비가 사라져 카드가 눌린다** — Regular만으로는 안 된다.
2. **flexbox만 지원.** `display: grid` 불가. 자식이 둘 이상인 요소는 `display: flex` 명시.
3. **`metadataBase`** 를 layout에 설정해 OG URL이 절대경로가 되게 한다.
4. **크롤러 캐시.** 소셜은 OG를 오래 캐시하므로 이미지 URL에 `?v=publishedAt`을 붙인다.
5. **말줄임 없음.** satori에 `text-overflow`가 없다. 긴 제목은 코드에서 잘라야 한다.

### 카드에 무엇을 싣는가
카운트만 실으면 안 된다. 제품 이름이 "같은 사건, 다른 제목"인데 정작 제목이 없으면 카드만 보고는 무슨 서비스인지 알 수 없다. **프레임마다 대표 제목 한 줄**을 싣고, 마지막에 남는 인상은 '보도하지 않음' 숫자 하나로 만든다.

---

## 7. 큐레이션 도구

**웹 admin을 만들지 않는다.** 하루 1~3건인데 UI를 만들 이유가 없고, 정적 사이트에 인증 화면을 붙이면 표면만 늘어난다.

로컬 CLI (`scripts/`, Admin SDK + 서비스 계정):

```bash
npm run curate -- list                    # 미배정 item 최근 목록
npm run curate -- new "○○ 정책 발표"      # 사건 생성
npm run curate -- attach <eventId> <itemIds...>
npm run curate -- draft <eventId>         # LLM 프레임 초안
npm run curate -- review <eventId>        # 터미널에서 확인·수정
npm run curate -- publish <eventId>       # status=published → 자동 배포
```

운영이 손에 익고 병목이 확인되면 그때 웹 admin을 만든다.

---

## 8. 설정 파일

### `next.config.ts`
```ts
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};
```
`redirects` / `rewrites` / `headers`는 export에서 동작하지 않는다. 전부 `firebase.json`으로 옮긴다.

### `firebase.json` (핵심만)
```jsonc
{
  "hosting": {
    "public": "out",
    "cleanUrls": false,        // trailingSlash:true 와 함께 쓰면 리다이렉트 중복 → 배포 후 실제 동작 확인 필요
    "headers": [
      { "source": "/_next/static/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
      { "source": "**/*.html",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
      { "source": "**/opengraph-image*",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=86400" }] }
    ]
  }
}
```
HTML을 `max-age=0`으로 둬야 재배포가 즉시 반영된다.

### `firestore.rules`
```
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```
v1에는 클라이언트 접근이 전혀 없다. 기여 기능이 생길 때 열되, 그때도 화이트리스트 방식으로만 연다.

---

## 9. 법적·윤리적 방어 장치

이 제품은 "판정하지 않는다"가 유일한 방어선이다. 코드 레벨에서 강제한다.

| 장치 | 구현 |
|---|---|
| 매체 고정 라벨 없음 | `sources` 스키마에 성향/등급 필드를 두지 않음 |
| 점수·순위 없음 | 집계는 조회 시점 사실 계산만. 저장하지 않음 |
| 원문 100% 링크 | 링크 없는 제목은 렌더 자체를 막음 (타입 레벨에서 `url` required) |
| 인용 최소화 | 제목·매체명·시각만 저장. 본문 미저장 |
| 근거 시각 표기 | `coverage.checkedAt`을 화면 필수 노출 |
| 방법론 공개 | `/method`에 매체 선정 기준·분류 규칙·한계 명시 |
| 매체 목록 공개 | `/sources`에 전체 목록 + 추가/제외 이력 |
| 정정 창구 | 이메일 + 정정 시 사건 페이지에 정정 이력 표시 |

**매체 목록 구성이 편향 시비의 최대 리스크다.** 한쪽 진영 매체만 넣으면 즉시 무너진다. 발행부수·트래픽 등 **외부 공개 지표**로 기계적으로 선정하고, 그 기준을 `/method`에 박아둔다.

---

## 10. 비용

| 항목 | 추정 |
|---|---|
| Firestore | 문서 수천 건/월 → 무료 티어 |
| Functions | 하루 ~10회 호출 → 무료 티어 |
| Hosting | 정적 + CDN → 무료 티어 (급증 시에도 저렴) |
| YouTube API | 일 200 units / 10,000 → 무료 |
| 네이버 검색 API | 일 25,000건 무료 |
| Claude API | 하루 1~3건 × 제목 50개 → 월 $1 미만 |
| GitHub Actions | 하루 4~6 빌드 × 3분 → 무료 티어 |

**월 $5 미만.** 실패해도 손실이 시간뿐이라는 게 이 MVP의 큰 장점이다.

---

## 11. 구현 순서

| # | 내용 | 기간 |
|---|---|---|
| M1 | Firestore 스키마 + `sources` 시드 50개 + `collect` Function (RSS·YouTube) | 3~4일 |
| M2 | 큐레이션 CLI + `draftFrames` (Claude) | 3일 |
| M3 | 프론트 3페이지(`/`, `/e/[slug]`, `/sources`) + OG + 공유 카드 | 4일 |
| M4 | 발행 파이프라인 (onPublish → Actions → deploy) + 재확인 스케줄 | 2일 |
| M5 | `/method`, `/about`, sitemap, GA4, 도메인 연결 | 2일 |

**약 2.5~3주.**

### 현재 상태
저장소는 create-next-app 초기 상태(Next 16.2.12, Tailwind v4)에서 시작한다. Firebase 의존성은 아직 없으며 M1에서 추가한다.

M0으로 사건 상세 화면의 포맷 검증본을 먼저 만들었다 (`/e/[slug]`, 샘플 데이터). 매체명과 제목은 전부 가상이다 — 실재 매체에 지어낸 제목을 붙이면 그 자체가 허위 보도 기록이 되기 때문이다.

---

## 12. 성공 지표 (런칭 후 2~4주)

| 지표 | 판단 |
|---|---|
| 공유 1건당 유입 수 | 1.5 미만이면 카드 포맷 실패 |
| 7일 재방문율 | 15% 미만이면 일간 니즈 가설 실패 |
| "보도하지 않음" 섹션 클릭 비중 | 예상대로 최상위면 v2를 여기에 집중 |

지표가 안 나오면 **기능을 추가해 살리려 하지 말 것.** 그게 위키가 죽는 방식이다.

---

## 13. 명시적 비범위 (v1)

로그인 · 회원가입 · 사용자 기여 · 댓글 · 관계도 그래프 · 계정 점수/등급 · X/Threads 수집 · 푸시 알림 · 웹 admin · 다국어.

관계도는 사건 90건이 쌓인 뒤 **누적 데이터의 부산물**로 만든다. 지금 만들면 감으로 그린 그림이 된다.
