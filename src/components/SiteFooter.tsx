import Link from "next/link";

/**
 * 하단 푸터 — 정정 요청 경로와 잼통 자매 앱.
 *
 * 자매 앱은 서로를 근거로 쓴다(Voice·신고 센터가 잼통의 근거를 인용한다). 이 사이트만
 * 어디로도 연결되지 않아, 보도를 보다가 업적·발언 원자료로 건너갈 길이 없었다.
 */
const FAMILY = [
  { name: "잼통", role: "업적", href: "https://jamtong.kr" },
  { name: "임통", role: "인물 언행", href: "https://im.jamtong.kr" },
  { name: "통통", role: "청년 정책", href: "https://tt.jamtong.kr" },
  { name: "잼통 Voice", role: "시민 질문", href: "https://voice.jamtong.kr" },
  { name: "잼통 신고 센터", role: "거짓 정보 신고", href: "https://bot.jamtong.kr" },
] as const;

export default function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-2xl space-y-4 border-t border-zinc-200 px-5 pb-6 pt-5 text-xs text-zinc-500 dark:border-zinc-800">
      <p>
        모든 제목은 원문 링크가 걸린 인용입니다. 잘못된 분류나 &lsquo;보도하지 않음&rsquo;을
        발견하셨다면{" "}
        <Link href="/method#correction" className="underline underline-offset-4">
          정정 요청
        </Link>
        해 주세요.
      </p>

      <nav aria-label="잼통 자매 앱" className="space-y-2">
        <p className="font-semibold text-zinc-600 dark:text-zinc-400">잼통 자매 앱</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {FAMILY.map((app) => (
            <li key={app.href}>
              <a href={app.href} className="underline-offset-4 hover:underline">
                <span className="text-zinc-700 dark:text-zinc-300">{app.name}</span>{" "}
                <span>{app.role}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
