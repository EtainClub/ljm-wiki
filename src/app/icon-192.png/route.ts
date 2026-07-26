import { iconResponse } from "@/lib/app-icon";

// 정적 export: 파라미터 없는 route handler 는 force-static 을 명시해야 파일로 떨어진다.
export const dynamic = "force-static";

export function GET() {
  return iconResponse(192);
}
