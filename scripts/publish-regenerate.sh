#!/usr/bin/env bash
# 발행 workflow 전용: Firestore 에 이미 반영된 사건의 파일 산출물을 (다시) 만든다.
# Firestore 를 바꾸지 않으므로 push 경합 뒤 최신 main 위에서 몇 번이고 다시 돌려도 된다.
#
#   scripts/publish-regenerate.sh <processed-list>
#
# processed-list 의 각 줄은 "<marker 경로> <event id>".
set -euo pipefail

list="$1"

while read -r marker event_id; do
  rm -f "$marker"
  npm --prefix functions run export:sources -- --event "$event_id"
done < "$list"

npm --prefix functions run wiki:people
npm --prefix functions run wiki:outlets
npm --prefix functions run wiki:lint
