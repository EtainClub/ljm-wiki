import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "방법론과 한계",
  description:
    "무엇을 어떻게 모으고, 무엇을 하지 않는지. 사건·매체 선정 기준과 프레임 분류 규칙, 그리고 이 자료의 한계.",
};

/**
 * 이 페이지는 장식이 아니다.
 * '어떤 기준으로 골랐냐'는 물음에 답할 수 있는 유일한 문서이고,
 * 편향 시비가 붙었을 때 내놓을 것도 이것뿐이다. 실데이터를 붙이기 전에 확정한다.
 */
export default function MethodPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">방법론과 한계</h1>
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          이 사이트가 무엇을 어떻게 모으는지, 그리고 무엇을 하지 않는지 적어
          둡니다. 기준을 공개하지 않으면 어떤 분류도 신뢰받을 수 없다고 봅니다.
        </p>
        <p className="rounded-lg border border-dashed border-zinc-400 px-4 py-3 text-xs leading-5 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
          현재 공개된 내용은 <strong className="font-semibold">초안</strong>이며,
          실제 데이터 수집을 시작하기 전에 확정합니다.
        </p>
      </header>

      <Section title="하는 일">
        <p>
          하나의 사건을 정하고, 미리 정해 둔 매체·채널 목록이 그 사건에 <em>어떤
          제목을 달았는지</em>{" "}원문 그대로 모아 나란히 놓습니다. 제목은 요약하거나
          바꿔 쓰지 않고, 모든 항목에 원문 링크를 겁니다.
        </p>
      </Section>

      <Section title="하지 않는 일">
        <p>이 셋은 의도적으로 만들지 않습니다.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold">매체별 성향·등급 라벨.</strong>{" "}
            어느 매체가 어느 편이라는 표시를 데이터에 저장하지 않습니다. 고정
            라벨은 그 자체로 낙인이 되고, 한 번 붙으면 개별 보도를 보지 않게
            만듭니다. 분류는 <em>사건 단위로만</em>{" "}존재합니다.
          </li>
          <li>
            <strong className="font-semibold">신뢰도 점수·순위.</strong>{" "}매체를
            숫자로 줄 세우지 않습니다. 집계는 조회 시점에 사실로만 계산하고
            (예: &ldquo;이 사건을 다루지 않은 곳 15&rdquo;), 어디에도 누적
            점수를 저장하지 않습니다.
          </li>
          <li>
            <strong className="font-semibold">보도 내용에 대한 판정.</strong>{" "}
            어떤 제목이 옳은지 그른지 말하지 않습니다. 나란히 놓을 뿐이고, 판단은
            보시는 분이 합니다.
          </li>
        </ul>
      </Section>

      <Section title="사건은 어떻게 고르나">
        <p>
          자동 선정하지 않습니다. 사람이 하루 1~3건을 고릅니다. 자동화하면
          속도는 붙지만, 무엇이 &lsquo;하나의 사건&rsquo;인지 판단이 어긋나
          비교 자체가 성립하지 않습니다.
        </p>
        <p>기준은 다음과 같습니다.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>발표·발생 시점이 특정 가능할 것 (보도 지연을 재려면 기준점이 필요합니다)</li>
          <li>복수의 매체가 다룰 만한 공적 사안일 것</li>
          <li>개인의 사생활이나 신원이 중심이 되는 사안은 제외</li>
        </ul>
      </Section>

      <Section title="매체는 어떻게 정하나">
        <p>
          매체 목록은 <Link href="/sources" className="underline underline-offset-4">전부 공개</Link>합니다.
          한쪽 진영 매체만 담으면 비교가 성립하지 않으므로, 편집자의 인상이 아니라
          외부에 공개된 지표로 기계적으로 정합니다.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>언론: 공개된 발행부수·열독률·포털 제휴 여부 등 확인 가능한 지표</li>
          <li>유튜브: 구독자 수와 정치·시사 분야 업로드 빈도</li>
          <li>사건마다 목록을 바꾸지 않습니다. 목록은 고정이고, 변경은 이력으로 남깁니다</li>
        </ul>
        <p>
          목록에 없는 곳이 그 사건을 다뤘더라도 이 사이트에는 나타나지 않습니다.
          즉 <strong className="font-semibold">&lsquo;전체 언론&rsquo;이 아니라 &lsquo;이 목록&rsquo;에 대한 관찰</strong>입니다.
        </p>
      </Section>

      <Section title="프레임은 어떻게 나누나">
        <p>
          사건마다 제목들을 읽고 2~4개로 묶습니다. 초안은 자동으로 만들지만
          그대로 공개하지 않고, 사람이 검수한 뒤에만 게시합니다.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>판단 근거는 <strong className="font-semibold">제목뿐</strong>입니다. 본문은 읽지도 저장하지도 않습니다</li>
          <li>
            묶음 이름은 서술형으로 씁니다 (&ldquo;&lsquo;재원·실효성 우려&rsquo;를
            앞세움&rdquo;). &lsquo;왜곡&rsquo;, &lsquo;악의적&rsquo; 같은 평가어를
            쓰지 않습니다
          </li>
          <li>어느 묶음에도 맞지 않으면 억지로 배정하지 않고 &lsquo;기타&rsquo;로 둡니다</li>
        </ul>
      </Section>

      <Section title="&lsquo;보도하지 않음&rsquo;은 무슨 뜻인가">
        <p>
          목록에 있는 매체 중, <strong className="font-semibold">확인 시각까지</strong>{" "}
          그 사건을 다룬 기사·영상을 찾지 못했다는 뜻입니다. 그래서 모든 사건
          페이지에 확인 시각을 함께 적습니다.
        </p>
        <p>
          발행 후 6·12·24·48시간 시점에 다시 확인합니다. 그 사이에 보도되면
          목록에서 빠지고 <em>보도 지연 시간</em>으로 바뀝니다. 늦게라도 다뤘다는
          사실이 다루지 않았다는 표시보다 정확하기 때문입니다.
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          다루지 않은 데에는 여러 이유가 있을 수 있습니다. 이 표시는 사실 기록이지
          비판이 아닙니다.
        </p>
      </Section>

      <Section title="제목 변경은 어떻게 확인하나">
        <p>
          수집한 항목의 제목을 주기적으로 다시 읽어, 처음 관측한 제목과 다르면
          두 제목을 관측 시각과 함께 남깁니다. 원래 제목을 복원해 주장하는 것이
          아니라, <strong className="font-semibold">우리가 언제 무엇을 봤는지</strong>를 기록하는 것입니다.
        </p>
      </Section>

      <Section title="한계">
        <ul className="list-disc space-y-2 pl-5">
          <li>제목만 봅니다. 제목과 본문의 논조가 다를 수 있습니다</li>
          <li>고정된 목록만 관찰합니다. 전체 언론을 대표하지 않습니다</li>
          <li>사건 선정과 프레임 분류에는 사람의 판단이 들어갑니다</li>
          <li>수집 시점 사이에 올라왔다가 내려간 것은 놓칠 수 있습니다</li>
          <li>
            보도 여부는 검색으로 확인합니다. 같은 사건을 아주 다른 표현으로 쓴
            기사는 검색에 걸리지 않아 놓칠 수 있습니다
          </li>
          <li>&lsquo;보도하지 않음&rsquo;은 확인 시각 기준이며, 확정된 사실이 아닙니다</li>
        </ul>
      </Section>

      <Section title="정정 요청">
        <p>
          분류가 잘못됐거나, 다뤘는데 &lsquo;보도하지 않음&rsquo;에 들어갔거나,
          목록에서 빠지길 원하시면 알려 주세요. 확인 후 정정하고, 해당 사건
          페이지에 정정 이력을 남깁니다.
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">연락처: (준비 중)</p>
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-zinc-200 pb-2 text-base font-semibold dark:border-zinc-800">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-7">{children}</div>
    </section>
  );
}
