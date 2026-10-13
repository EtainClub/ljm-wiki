#!/usr/bin/env bash
# 발행 workflow 전용: Firestore 에 이미 반영된 사건의 파일 산출물을 (다시) 만든다.
# Firestore 를 바꾸지 않으므로 push 경합 뒤 최신 main 위에서 몇 번이고 다시 돌려도 된다.
#
#   scripts/publish-regenerate.sh <processed-list>
#
# processed-list 의 각 줄은 "<marker 경로> <event id>".
set -euo pipefail

list="$1"

# 대기열 전체에서 같은 TypeScript 빌드를 반복하지 않는다.
npm --prefix functions run build

while read -r marker event_id; do
  rm -f "$marker"
  node functions/lib/scripts/export-sources.js --event "$event_id"
done < "$list"

node functions/lib/scripts/wiki-people.js
node functions/lib/scripts/wiki-outlets.js
node functions/lib/scripts/wiki-lint.js
