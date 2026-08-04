#!/usr/bin/env bash
set -euo pipefail

unexpected="$({
  git diff --name-only
  git ls-files --others --exclude-standard
} | sort -u | awk '$0 !~ /^(sources|wiki)\//')"

if [[ -n "$unexpected" ]]; then
  echo "Automation changed paths outside sources/ and wiki/:" >&2
  echo "$unexpected" >&2
  exit 1
fi

