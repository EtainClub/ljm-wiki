"use client";

import { useEffect } from "react";

/**
 * 정적 Firebase Hosting 시절의 서비스 워커를 한 번 정리한다.
 *
 * 사건·공유 카드가 새로 발행되어도 이전 HTML/PNG가 남지 않게 App Hosting에서는
 * 오프라인 캐시를 등록하지 않는다. 기존 방문자의 등록분과 Cache Storage도 제거한다.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    void navigator.serviceWorker
      ?.getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );

    void caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
  }, []);

  return null;
}
