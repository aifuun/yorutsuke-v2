#!/bin/bash
# Clean all Vite dev ports
# Usage: npm run clean:ports

echo "🧹 Cleaning Vite dev ports..."

PORTS=(1420 1421 1422 1423 1424 1425 1426 1427)

for PORT in "${PORTS[@]}"; do
  PID=$(lsof -ti :$PORT 2>/dev/null)
  if [ ! -z "$PID" ]; then
    echo "⚠️  Port $PORT: killing process $PID"
    kill -9 $PID 2>/dev/null
  fi
done

echo "✅ All ports cleaned"
