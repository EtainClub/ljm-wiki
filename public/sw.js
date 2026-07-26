/**
 * 오프라인 지원용 서비스 워커.
 *
 * Serwist 같은 도구를 쓰지 않는다 — webpack 설정을 요구하는데 이 프로젝트는
 * Turbopack 을 쓰고, 필요한 전략이 두 가지뿐이라 직접 쓰는 편이 단순하다.
 *
 * 전략
 *  - 문서(navigate): 네트워크 우선. 사건 내용은 매일 바뀌므로 캐시를 먼저 주면 안 된다.
 *    실패하면 캐시 → 그것도 없으면 /offline/.
 *  - /_next/static/: 캐시 우선. 파일명에 해시가 있어 내용이 바뀌면 경로가 바뀐다.
 *  - 이미지(png): stale-while-revalidate.
 *
 * CACHE_VERSION 을 올리면 이전 캐시가 activate 에서 정리된다.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline/";

const SHELL_URLS = ["/", "/archive/", "/sources/", "/method/", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // 한 곳이라도 실패하면 설치 전체가 실패하므로 개별로 넣는다.
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.endsWith(".png") || url.pathname.endsWith(".ico")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await caches.match(request));
    if (cached) return cached;
    return (
      (await caches.match(OFFLINE_URL)) ||
      new Response("오프라인입니다.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
