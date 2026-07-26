/**
 * 피드 가져오기.
 *
 * 국내 언론 RSS 를 실제로 찔러 보고 나온 문제들을 그대로 처리한다.
 *  - 일시 실패가 잦다 (연합뉴스는 첫 시도 실패, 재시도에서 120건) → 재시도
 *  - EUC-KR 로 내려주는 곳이 있다 (국민일보) → charset 디코딩
 *  - HTTPS 에서 TLS 협상이 깨지는 곳이 있다 (이데일리) → http 폴백
 *  - 폐지된 피드가 HTML 안내문을 200 으로 준다 (중앙일보) → 파싱 단계에서 걸러짐
 */

const UA = "Mozilla/5.0 (compatible; same-event-different-headline/1.0)";
const ACCEPT = "application/rss+xml, application/atom+xml, application/xml, text/xml, */*";
const TIMEOUT_MS = 15_000;

export interface FetchedFeed {
  text: string;
  contentType: string;
  finalUrl: string;
  /** https 가 막혀 http 로 내려받았는지 */
  downgraded: boolean;
}

function charsetOf(contentType: string, head: Buffer): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();

  // <?xml version="1.0" encoding="EUC-KR"?>
  const decl = head.subarray(0, 200).toString("latin1");
  const fromXml = /encoding=["']([\w-]+)["']/i.exec(decl)?.[1];
  return (fromXml ?? "utf-8").toLowerCase();
}

function decode(buf: Buffer, charset: string): string {
  // Node 20+ 는 full-icu 를 포함하므로 euc-kr 라벨을 인식한다.
  // 그래도 인식 못 하면 utf-8 로 떨어뜨린다 — 깨진 글자가 나오는 편이 조용한 실패보다 낫다.
  for (const label of [charset, "euc-kr", "utf-8"]) {
    try {
      return new TextDecoder(label, { fatal: false }).decode(buf);
    } catch {
      continue;
    }
  }
  return buf.toString("utf8");
}

async function once(url: string): Promise<FetchedFeed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: ACCEPT },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "";
    return {
      text: decode(buf, charsetOf(contentType, buf)),
      contentType,
      finalUrl: res.url || url,
      downgraded: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 재시도 2회 + TLS 실패 시 http 폴백. */
export async function fetchFeed(url: string, attempts = 3): Promise<FetchedFeed> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await once(url);
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await sleep(500 * 2 ** i);
    }
  }

  // TLS 협상 자체가 안 되는 서버가 있다. 공개 피드 읽기이고 자격증명이 오가지
  // 않으므로 http 로 한 번 더 시도하되, 내려받았다는 사실을 기록해 둔다.
  if (url.startsWith("https://") && isTlsError(lastError)) {
    try {
      const res = await once(`http://${url.slice("https://".length)}`);
      return { ...res, downgraded: true };
    } catch {
      /* 폴백도 실패하면 원래 오류를 던진다 */
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function isTlsError(e: unknown): boolean {
  const msg = [
    e instanceof Error ? e.message : "",
    e instanceof Error && e.cause instanceof Error ? e.cause.message : "",
  ].join(" ");
  return /SSL|TLS|unsupported protocol|EPROTO/i.test(msg);
}
