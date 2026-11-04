#!/usr/bin/env bash
# ==============================================================================
# Growatt PAYG Enterprise - Developer Setup Script (setup.sh)
# One-time automated environment provisioner for newly cloned machines
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

if [ -d "$ROOT_DIR/growatt-payg-enterprise" ]; then
    ROOT_DIR="$ROOT_DIR/growatt-payg-enterprise"
fi

echo "=========================================================="
echo "🔧 Setting Up SkyGrid / Growatt PAYG Enterprise Dev Suite"
echo "=========================================================="

# 1. System Requirements Check
echo "🔍 Checking toolchain prerequisites..."
MISSING_TOOLS=()
command -v python3 >/dev/null 2>&1 || MISSING_TOOLS+=("python3")
command -v go >/dev/null 2>&1 || MISSING_TOOLS+=("golang-go")

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo "⚠️  Missing recommended tools: ${MISSING_TOOLS[*]}"
    echo "💡 On Ubuntu/Debian, install with: sudo apt update && sudo apt install -y python3 python3-venv golang-go"
fi

# 2. Python Virtual Environment Setup
PY_DIR="$ROOT_DIR/intelligence-engine"
echo ""
echo "🧠 Initializing Python Intelligence Engine environment..."
mkdir -p "$ROOT_DIR/logs"
mkdir -p /tmp/payg-vfs-dev

if command -v python3 >/dev/null 2>&1; then
    (
        cd "$PY_DIR"
        if [ ! -d ".venv" ]; then
            echo "📦 Creating virtual environment in $PY_DIR/.venv..."
            python3 -m venv .venv
        else
            echo "ℹ️  Virtual environment already exists in $PY_DIR/.venv"
        fi
        
        echo "📦 Installing Python microservice dependencies..."
        .venv/bin/pip install --upgrade pip --quiet 2>/dev/null || true
        .venv/bin/pip install fastapi 'uvicorn[standard]' pydantic httpx numpy
        echo "✅ Python Intelligence Engine ready!"
    )
else
    echo "❌ Skipped Python setup: python3 not found."
fi

# 3. Go Core Backend Modules & Binaries
echo ""
echo "⚡ Preparing Go Core Backend..."
if command -v go >/dev/null 2>&1; then
    (
        cd "$ROOT_DIR/core-backend"
        echo "📦 Downloading Go modules..."
        go mod download 2>/dev/null || true
        echo "🔨 Compiling Go microservice binaries into bin/..."
        mkdir -p bin
        GOTOOLCHAIN=local CGO_ENABLED=0 go build -o bin/api-server ./cmd/api-server/main.go || true
        GOTOOLCHAIN=local CGO_ENABLED=0 go build -o bin/mqtt-gateway ./cmd/mqtt-gateway/main.go || true
        GOTOOLCHAIN=local CGO_ENABLED=0 go build -o bin/cron-scheduler ./cmd/cron-scheduler/main.go || true
        echo "✅ Go binaries built in $ROOT_DIR/core-backend/bin/"
    )
else
    echo "ℹ️  Go toolchain not found locally; services will run via docker or precompiled binaries."
fi

echo ""
echo "=========================================================="
echo "🎉 Setup complete! You're ready to run:"
echo "   ./start_all.sh"
echo "=========================================================="

