import { iconResponse } from "@/lib/app-icon";

export const dynamic = "force-static";

/** 브라우저 탭용. 32px 에서도 막대 네 개가 구분되도록 여백을 줄인다. */
export function GET() {
  return iconResponse(32);
}
