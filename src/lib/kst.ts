/**
 * 모든 시각은 KST 로 고정 표기한다.
 * timeZone 을 명시해야 빌드(서버)와 브라우저의 렌더 결과가 같아진다.
 */

const TZ = "Asia/Seoul";

const timeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const longDateFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
export const formatLongDate = (iso: string) => longDateFmt.format(new Date(iso));

/** 사건 발생 대비 보도 지연을 사람이 읽는 형태로. */
export function formatDelay(minutes: number): string {
  if (minutes < 0) return `${Math.abs(minutes)}분 전`;
  if (minutes < 60) return `+${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `+${h}시간` : `+${h}시간 ${m}분`;
}
