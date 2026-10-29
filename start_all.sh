#!/usr/bin/env bash
# ==============================================================================
# Growatt PAYG Enterprise - Unified Process Orchestrator (start_all.sh)
# Boots Infrastructure, Core Go Backend, Background Workers & Intelligence Engine
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

if [ -d "$ROOT_DIR/growatt-payg-enterprise" ]; then
    ROOT_DIR="$ROOT_DIR/growatt-payg-enterprise"
fi

LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
mkdir -p /tmp/payg-vfs-dev

declare -a PIDS=()

cleanup() {
    echo ""
    echo "=========================================================="
    echo "🛑 Shutting down all Growatt PAYG Enterprise services..."
    echo "=========================================================="
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done

    # Give processes a moment to exit gracefully
    sleep 1
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    done

    echo "✅ All background services stopped cleanly."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "=========================================================="
echo "🚀 Booting Enterprise Growatt PAYG & Smart Energy Platform"
echo "=========================================================="

# 1. Docker Infrastructure (Postgres 16, EMQX 5, Redis 7)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "🐳 [1/4] Starting Docker cluster (Postgres, EMQX, Redis)..."
    (cd "$ROOT_DIR" && docker compose up -d) || echo "⚠️  Docker compose up failed, continuing with local services..."
else
    echo "ℹ️  [1/4] Docker daemon not active; proceeding with application microservices..."
fi

# 2. Python Intelligence Engine (FastAPI & ML Forecasting)
echo "🧠 [2/4] Starting Python Intelligence Engine on http://localhost:8000..."
(
    cd "$ROOT_DIR/intelligence-engine"
    if [ -f ".venv/bin/uvicorn" ]; then
        PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
    else
        python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
    fi
) > "$LOG_DIR/intelligence-engine.log" 2>&1 &
PIDS+=($!)

# 3. Core Go API Server
echo "⚡ [3/4] Starting Core Go API Server on http://localhost:8080..."
(
    cd "$ROOT_DIR/core-backend"
    if [ -x "bin/api-server" ]; then
        ./bin/api-server
    else
        GOTOOLCHAIN=local CGO_ENABLED=0 GOCACHE=/tmp/go-build GOPATH=/tmp/go go run ./cmd/api-server/main.go
    fi
) > "$LOG_DIR/api-server.log" 2>&1 &
PIDS+=($!)

# 4. Background Workers (MQTT Gateway & Cron Scheduler)
echo "📡 [4/4] Starting Background Workers (MQTT Gateway & Cron Scheduler)..."
(
    cd "$ROOT_DIR/core-backend"
    if [ -x "bin/mqtt-gateway" ]; then
        ./bin/mqtt-gateway
    else
        GOTOOLCHAIN=local CGO_ENABLED=0 GOCACHE=/tmp/go-build GOPATH=/tmp/go go run ./cmd/mqtt-gateway/main.go
    fi
) > "$LOG_DIR/mqtt-gateway.log" 2>&1 &
PIDS+=($!)

(
    cd "$ROOT_DIR/core-backend"
    if [ -x "bin/cron-scheduler" ]; then
        ./bin/cron-scheduler
    else
        GOTOOLCHAIN=local CGO_ENABLED=0 GOCACHE=/tmp/go-build GOPATH=/tmp/go go run ./cmd/cron-scheduler/main.go
    fi
) > "$LOG_DIR/cron-scheduler.log" 2>&1 &
PIDS+=($!)

echo ""
echo "⏳ Waiting for health check endpoints..."

# Health check polling
for i in {1..20}; do
    CORE_HEALTH=$(curl -s http://localhost:8080/healthz || echo "")
    PY_HEALTH=$(curl -s http://localhost:8000/healthz || echo "")

    if [[ "$CORE_HEALTH" == *"healthy"* ]] && [[ "$PY_HEALTH" == *"healthy"* ]]; then
        break
    fi
    sleep 1
done

echo ""
echo "=========================================================="
echo "🎉 ALL SERVICES ONLINE AND HEALTHY!"
echo "=========================================================="
echo "• Core REST API:            http://localhost:8080"
echo "  - Sizing & ROI Calculator: http://localhost:8080/api/v1/public/catalog"
echo "  - Health Check:            http://localhost:8080/healthz"
echo "• Intelligence Engine:      http://localhost:8000"
echo "  - Interactive Swagger Docs: http://localhost:8000/docs"
echo "  - Forecasting Health Check: http://localhost:8000/healthz"
echo "• MQTT Gateway (EMQX):      tcp://localhost:1883"
echo "• EMQX Admin Dashboard:     http://localhost:18083"
echo "=========================================================="
echo "📝 Streaming live server logs (Press Ctrl+C to stop all)..."
echo "=========================================================="
echo ""

# Stream logs with prefixes
tail -f "$LOG_DIR/api-server.log" "$LOG_DIR/intelligence-engine.log" &
TAIL_PID=$!
PIDS+=($TAIL_PID)

wait

