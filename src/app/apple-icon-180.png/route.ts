import { iconResponse } from "@/lib/app-icon";

export const dynamic = "force-static";

// iOS 홈 화면 아이콘. iOS 는 마스킹을 하지 않으므로 기본 여백을 쓴다.
export function GET() {
  return iconResponse(180);
}
