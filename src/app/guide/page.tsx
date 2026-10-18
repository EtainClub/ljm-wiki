import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { TOPICS } from "@/lib/topics";

export const metadata: Metadata = {
  title: "처음 오셨나요",
  description: "사건 페이지를 읽는 법, 제목의 겉과 속을 보는 법, 무엇이 어디에 있는지.",
};

/**
 * 이용 안내. 자매 앱(잼통·임통·Voice·신고 센터)이 모두 /guide 를 둔다.
 * /method 가 '어떤 기준으로 모으나' 에 답한다면 이 페이지는 '어떻게 보면 되나' 에 답한다.
 */
export default function GuidePage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">처음 오셨나요</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          {BRAND.name}은 이재명 정부를 다루는 언론과 정치 유튜브가 같은 사건에 어떤 제목을
          달았는지 나란히 모읍니다. 한 매체의 제목만 보면 보이지 않는 것이, 다른 매체의
          제목 옆에 두면 보입니다.
        </p>
      </header>

      <Section title="사건 페이지 읽는 법">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong className="font-semibold">색 막대</strong> — 언론사들이 이 사건을 어떤 말로
            시작했는지 묶은 비율입니다. 색은 구분용일 뿐 좋고 나쁨이 아닙니다. 회색은
            보도하지 않은 곳입니다.
          </li>
          <li>
            <strong className="font-semibold">보도 태도</strong> — 기사·영상마다 제목과 리드를 읽고
            지지·호평, 사실 전달, 정책 비판, 의혹 제기, 비난·조롱, 기타로 나눈 분포입니다.
            프레임이 &lsquo;제목에 쓴 말&rsquo;이라면 태도는 &lsquo;정부를 다루는 방식&rsquo;입니다.
            빨간 <em>겉과 속 주의</em>는 지지·사실 전달로 분류된 제목에 사건에 없던 탄핵·지지율
            하락 같은 말이 붙은 경우입니다.
          </li>
          <li>
            <strong className="font-semibold">언론 보도</strong> — 묶음(프레임)마다 원제를 보도
            시각순으로 둡니다. 시각 옆 <em>+분</em>은 사건 발생부터 걸린 시간이고, 제목 아래
            작은 글씨는 태도 분류의 근거입니다.
          </li>
          <li>
            <strong className="font-semibold">연결된 유튜브 영상</strong> — 등록 채널의 영상 중
            제목과 게시 시각 기준을 채운 것입니다. 영상 내용은 판정하지 않습니다.
          </li>
          <li>
            <strong className="font-semibold">보도하지 않음</strong> — 두 가지로 나뉩니다.
            &lsquo;검색에서 찾지 못함&rsquo;은 적힌 검색어에 달린 값이고, &lsquo;검토 후
            제외&rsquo;는 기사가 있었지만 이 사건 보도가 아니라고 사람이 판단한 것입니다.
          </li>
          <li>
            <strong className="font-semibold">제목을 수정함</strong> — 게시 뒤 바뀐 제목입니다.
            모든 사건의 변경은{" "}
            <Link href="/changes" className="underline underline-offset-4">제목 변경 기록</Link>
            에 모여 있습니다.
          </li>
          <li>
            <strong className="font-semibold">관련 기록</strong> — 위키 사건 기록(집계 기준과
            판단 근거)과 제목에 등장한 인물 페이지로 이어집니다.
          </li>
        </ol>
      </Section>

      <Section title="제목의 겉과 속을 보는 법">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong className="font-semibold">덧붙은 말을 찾아보세요.</strong> 정부를 옹호하는
            듯한 제목에 사건과 상관없는 &lsquo;탄핵&rsquo;, &lsquo;지지율 하락&rsquo;,
            &lsquo;위기&rsquo; 같은 말이 함께 실렸는지 보세요.{" "}
            <Link href="/search?q=탄핵" className="underline underline-offset-4">검색</Link>은 기사·영상
            원제까지 찾습니다.
          </li>
          <li>
            <strong className="font-semibold">같은 사건의 다른 제목과 비교하세요.</strong> 다른
            매체 대부분이 쓰지 않은 말을 한 곳만 앞세웠다면, 그 차이가 그 매체의 선택입니다.
          </li>
          <li>
            <strong className="font-semibold">한 번이 아니라 반복을 보세요.</strong> 매체·채널
            위키 페이지에는 사건마다 어떤 프레임을 골랐고 언제 다루지 않았는지가 쌓입니다.
          </li>
          <li>
            <strong className="font-semibold">제목이 바뀌었는지 보세요.</strong> 처음 제목과 바뀐
            제목의 차이도 기록입니다.
          </li>
        </ul>
        <p className="text-zinc-600 dark:text-zinc-400">
          {BRAND.name}은 의도를 판정하지 않습니다. 확인할 수 있는 원문과 시각을 모아 둘 뿐이고,
          판단은 보시는 분이 합니다.
        </p>
      </Section>

      <Section title="무엇이 어디에">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt><Link href="/" className="underline underline-offset-4">오늘</Link></dt>
          <dd>최근 사건 7건</dd>
          <dt><Link href="/archive" className="underline underline-offset-4">지난</Link></dt>
          <dd>사건 전체. 쟁점별로 골라 볼 수 있습니다</dd>
          <dt><Link href="/youtube" className="underline underline-offset-4">유튜브</Link></dt>
          <dd>채널별 영상 제목과 표현 비교</dd>
          <dt><Link href="/w" className="underline underline-offset-4">위키</Link></dt>
          <dd>인물·매체·사건별로 쌓인 기록</dd>
          <dt><Link href="/analysis" className="underline underline-offset-4">분석</Link></dt>
          <dd>보도 태도 분포, 겉과 속 주의, 매체·채널별 건수</dd>
          <dt><Link href="/search" className="underline underline-offset-4">검색</Link></dt>
          <dd>사건과 기사·영상 원제, 인물, 매체</dd>
          <dt><Link href="/changes" className="underline underline-offset-4">제목 변경</Link></dt>
          <dd>게시 뒤 바뀐 제목 모음</dd>
          <dt><Link href="/method" className="underline underline-offset-4">방법</Link></dt>
          <dd>수집 기준, 한계, 정정 요청</dd>
        </dl>
      </Section>

      <Section title="쟁점은 어떻게 나누나" id="topics">
        <p>
          사람이 사건마다 붙이지 않고, <strong className="font-semibold">사건 제목에 아래 말이
          하나라도 있으면</strong> 그 쟁점으로 묶습니다. 누가 다시 해도 같은 결과가 나오게
          하려는 것입니다. 한 사건이 여러 쟁점에 들 수 있고, 어디에도 들지 않을 수도 있습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 pr-4 font-semibold">쟁점</th>
                <th className="py-2 font-semibold">제목에 있으면</th>
              </tr>
            </thead>
            <tbody>
              {TOPICS.map((topic) => (
                <tr key={topic.key} className="border-b border-zinc-100 align-top dark:border-zinc-900">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <Link href={`/archive?topic=${topic.key}`} className="underline underline-offset-4">
                      {topic.label}
                    </Link>
                  </td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">{topic.terms.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400">
          같은 이름의 쟁점이 임통에 있으면, 쟁점 목록에서 임통의 발언 기록으로 이어집니다.
        </p>
      </Section>

      <Section title="빠진 기사를 찾으셨다면">
        <p>
          사건 페이지의 &lsquo;보도하지 않음&rsquo; 아래 <em>빠진 기사 제보</em>를 눌러 원문
          링크를 보내 주세요. 확인한 뒤 보도로 옮기고 정정 이력을 남깁니다. 그 밖의 정정은{" "}
          <Link href="/method#correction" className="underline underline-offset-4">정정 요청</Link>
          으로 받습니다.
        </p>
      </Section>
    </article>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="border-b border-zinc-200 pb-2 text-base font-semibold dark:border-zinc-800">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-7">{children}</div>
    </section>
  );
}
