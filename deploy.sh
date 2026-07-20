#!/bin/bash
# 사용법: ./deploy.sh "무엇을 바꿨는지"
cd "$(dirname "$0")"
git add -A
git commit -m "${1:-update}" && echo "✅ 완료 — 1~2분 뒤 앱에 반영됩니다"
