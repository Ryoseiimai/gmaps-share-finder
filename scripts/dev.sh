#!/bin/bash
# 開発モード: Googleアカウント・Cloudflareアカウントなしで画面まで確認できるようにする。
# wrangler dev をローカルのみ(--local)で起動し、ダミー座標を流し込み、ブラウザで開く。
# 実行: bash scripts/dev.sh (または `npm run dev` / `make dev`)
# 停止: Ctrl+C
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8787}"
DEV_TOKEN="${DEV_TOKEN:-devtoken}"
URL="http://127.0.0.1:${PORT}"

if [ ! -d worker/node_modules ]; then
  echo "==> worker/node_modules がないため npm install します(初回のみ、数十秒かかります)"
  (cd worker && npm install)
fi

if [ ! -f worker/.dev.vars ]; then
  echo "SHARED_TOKEN=${DEV_TOKEN}" > worker/.dev.vars
  echo "==> worker/.dev.vars を作成しました(ローカル専用のダミートークン。Cloudflareアカウントは不要です)"
fi

echo "==> wrangler dev をローカルのみで起動します(実際のCloudflareには繋ぎません): ${URL}"
(cd worker && npx wrangler dev --port "${PORT}" --local) &
WRANGLER_PID=$!

FEED_PID=""
cleanup() {
  echo "==> 停止処理中..."
  if [ -n "${FEED_PID}" ]; then kill "${FEED_PID}" 2>/dev/null || true; fi
  kill "${WRANGLER_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo -n "==> 起動待ち"
READY=0
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "${URL}/" 2>/dev/null; then
    READY=1
    break
  fi
  echo -n "."
  sleep 1
done
echo ""
if [ "${READY}" != "1" ]; then
  echo "wrangler dev の起動を確認できませんでした。上のログを確認してください。" >&2
  exit 1
fi

echo "==> ダミーの相手位置を送り始めます(Googleアカウント不要)"
python3 scripts/dev_mock_feed.py --url "${URL}" --token "${DEV_TOKEN}" &
FEED_PID=$!

FULL_URL="${URL}/?token=${DEV_TOKEN}"
echo "==> 画面のURL: ${FULL_URL}"
if command -v open >/dev/null 2>&1; then
  open "${FULL_URL}"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${FULL_URL}"
else
  echo "手動でブラウザからこのURLを開いてください: ${FULL_URL}"
fi

echo "==> 開発サーバー稼働中。終了するには Ctrl+C"
wait "${WRANGLER_PID}"
