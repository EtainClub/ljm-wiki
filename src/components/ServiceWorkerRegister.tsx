"use client";

import { useEffect } from "react";

/** 오프라인 캐시만 담당한다. 푸시 알림은 v1 범위 밖이다. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* 등록 실패해도 사이트는 그대로 동작한다 */
      });
  }, []);

  return null;
}
