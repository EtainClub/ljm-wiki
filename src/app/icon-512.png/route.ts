import { iconResponse } from "@/lib/app-icon";

export const dynamic = "force-static";

export function GET() {
  return iconResponse(512);
}
