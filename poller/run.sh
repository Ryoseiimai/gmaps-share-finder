#!/bin/bash
# 60秒ごとに poll.py を実行し続ける(launchd化はしない・手動起動の遊び用途)。
# 止める時は stop.sh か Ctrl+C。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f config.json ]; then
  echo "config.json がありません。config.example.json をコピーして中身を埋めてください。" >&2
  exit 1
fi

PYTHON="./.venv/bin/python3"
if [ ! -x "$PYTHON" ]; then
  PYTHON="python3"
fi

echo $$ > poller/run.pid
trap 'rm -f poller/run.pid' EXIT

INTERVAL=$(python3 -c "import json;print(json.load(open('config.json')).get('poll_interval_seconds',60))")

while true; do
  "$PYTHON" poller/poll.py || echo "poll.py が失敗しました(次回リトライ)" >&2
  sleep "$INTERVAL"
done
