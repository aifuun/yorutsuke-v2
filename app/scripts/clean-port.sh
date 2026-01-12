#!/bin/bash
# Clean a specific port
# Usage: bash scripts/clean-port.sh <port>

PORT=${1:-1420}

echo "🧹 Cleaning port $PORT..."

PID=$(lsof -ti :$PORT 2>/dev/null)
if [ ! -z "$PID" ]; then
  echo "⚠️  Port $PORT: killing process $PID"
  kill -9 $PID 2>/dev/null
  echo "✅ Port $PORT cleaned"
else
  echo "✅ Port $PORT is free"
fi
