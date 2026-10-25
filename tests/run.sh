#!/bin/bash
# تشغيل اختبارات المتصفح: ./tests/run.sh [smoke|flows] [مجلد الصور]
# بيقوم سيرفر محلي، ويشغّل Playwright (Chromium)، ويطبع STATE والأخطاء.
set -u
cd "$(dirname "$0")/.."
T=${1:-smoke}; OUT=${2:-$(mktemp -d)}; PORT=${PORT:-8770}
mkdir -p "$OUT"
python3 -m http.server "$PORT" >/dev/null 2>&1 & SP=$!
trap 'kill $SP 2>/dev/null' EXIT
sleep 1
NODE_PATH=${NODE_PATH:-$(npm root -g)} OUT="$OUT" PORT="$PORT" timeout 300 node "tests/$T.js" 2>&1 | grep -v '^shot'
echo "screenshots: $OUT"
