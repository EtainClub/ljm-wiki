import { join } from "node:path";
import { generateCatalog } from "../wiki/catalog";

generateCatalog(join(__dirname, "..", "..", ".."));
console.log("사건별 ingest record에서 색인·이력·새 인물 페이지를 생성했습니다.");
