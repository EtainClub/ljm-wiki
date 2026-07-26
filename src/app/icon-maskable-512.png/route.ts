import { iconResponse } from "@/lib/app-icon";

export const dynamic = "force-static";

// 마스커블: 안드로이드가 바깥을 원형·물방울 등으로 잘라내므로 여백을 더 준다.
export function GET() {
  return iconResponse(512, true);
}
