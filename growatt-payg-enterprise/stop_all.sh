#!/usr/bin/env bash
# ==============================================================================
# Growatt PAYG Enterprise - Shutdown Script (stop_all.sh)
# Stops all running microservices, background workers, and docker containers
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

if [ -d "$ROOT_DIR/growatt-payg-enterprise" ]; then
    ROOT_DIR="$ROOT_DIR/growatt-payg-enterprise"
fi

echo "🛑 Stopping all Growatt PAYG Enterprise processes..."

# Force kill any processes on ports 8080 (Go API) and 8000 (Python FastAPI)
fuser -k -9 8080/tcp 2>/dev/null || true
fuser -k -9 8000/tcp 2>/dev/null || true
lsof -ti:8080 | xargs -r kill -9 2>/dev/null || true
lsof -ti:8000 | xargs -r kill -9 2>/dev/null || true

# Terminate named Go and Python binaries
pkill -9 -f "api-server" 2>/dev/null || true
pkill -9 -f "cmd/api-server" 2>/dev/null || true
pkill -9 -f "mqtt-gateway" 2>/dev/null || true
pkill -9 -f "cron-scheduler" 2>/dev/null || true
pkill -9 -f "app.main:app" 2>/dev/null || true
pkill -9 -f "uvicorn" 2>/dev/null || true

# Stop Docker containers if running
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    (cd "$ROOT_DIR" && docker compose down 2>/dev/null || true)
fi

echo "✅ All Growatt PAYG Enterprise services stopped."
