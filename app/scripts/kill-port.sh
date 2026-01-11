#!/bin/bash
# Kill process on specified port
# Usage: ./scripts/kill-port.sh 1424

PORT=${1:-1420}

echo "🔍 Checking port $PORT..."

PID=$(lsof -ti :$PORT)

if [ -z "$PID" ]; then
  echo "✅ Port $PORT is free"
  exit 0
fi

echo "⚠️  Found process $PID using port $PORT"
kill -9 $PID

if [ $? -eq 0 ]; then
  echo "✅ Killed process $PID"
else
  echo "❌ Failed to kill process $PID"
  exit 1
fi
