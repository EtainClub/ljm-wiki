#!/usr/bin/env bash
# 최신 main에 병합된 승인 표식만 처리한다. 로컬 복구와 GitHub Actions가 공유한다.
# 사용법: bash scripts/publish-ready.sh <processed-list>
# 재실행 시 curate가 이미 발행/정정된 사건을 건너뛴다.
set -euo pipefail
shopt -s nullglob

processed="${1:?processed-list 경로가 필요합니다}"
markers=(.automation/ready-events/*.json)
: > "$processed"
if [ "${#markers[@]}" -eq 0 ]; then
  echo "처리할 승인 표식이 없습니다."
  exit 0
fi

npm --prefix functions run build
for marker in "${markers[@]}"; do
  payload="$(node -e 'const fs=require("fs"); const path=require("path"); const p=process.argv[1]; const x=JSON.parse(fs.readFileSync(p,"utf8")); const action=x.version===1 ? "publish" : x.version===2 ? x.action : null; const suffix={"publish":".json","youtube-correction":".youtube-correction.json","tone-correction":".tone-correction.json"}[action]; if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-f0-9]{6}$/.test(x.eventId) || !suffix || path.basename(p)!==x.eventId+suffix) process.exit(2); process.stdout.write(action+":"+x.eventId)' "$marker")"
  action="${payload%%:*}"
  event_id="${payload#*:}"
  case "$action" in
    publish) node functions/lib/scripts/curate.js publish "$event_id" ;;
    youtube-correction) node functions/lib/scripts/curate.js apply-youtube-correction "$event_id" ;;
    tone-correction) node functions/lib/scripts/curate.js apply-tone-correction "$event_id" ;;
  esac
  echo "$marker $event_id" >> "$processed"
done
