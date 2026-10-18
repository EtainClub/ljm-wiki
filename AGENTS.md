<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 뉴스 승인 PR의 파일 소유권

뉴스 등록 시 [docs/CURATION-PRS.md](docs/CURATION-PRS.md)를 먼저 따른다.
승인 PR에는 사건별 sources·wiki/events·ready-events marker·ingest-record만 넣는다.
공통 wiki/index.md·log.md·people/*·outlets/*·프레임-군집.md는 PR에서 편집하지 않는다.
새 인물도 사건의 people 링크로 선언하고 병합 후 생성한다. 기존 스킬·문서의 공통 파일
직접 편집 지침보다 이 규칙이 우선한다. ready → queue:approval 뒤 위키 lint를 실행한다.
