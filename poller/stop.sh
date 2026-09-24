#!/bin/bash
cd "$(dirname "$0")/.."
if [ -f poller/run.pid ]; then
  PID=$(cat poller/run.pid)
  kill "$PID" 2>/dev/null && echo "run.sh (pid $PID) を停止しました" || echo "既に停止しています"
  rm -f poller/run.pid
else
  echo "run.pid が見つかりません(起動していない可能性)"
fi
