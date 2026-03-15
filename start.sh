#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

start_backend() {
    cd "$ROOT/backend"
    if [ ! -d "nova" ]; then
        python3.12 -m venv nova
    fi
    source nova/bin/activate
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    mkdir -p ./data/uploads ./data/faiss_index
    echo "==> Starting backend on :8000..."
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
    echo $! > /tmp/novamind_backend.pid
}

start_frontend() {
    cd "$ROOT/frontend"
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    echo "==> Starting frontend on :3000..."
    npm run dev &
    echo $! > /tmp/novamind_frontend.pid
}

cleanup() {
    [ -f /tmp/novamind_backend.pid ] && kill "$(cat /tmp/novamind_backend.pid)" 2>/dev/null || true
    [ -f /tmp/novamind_frontend.pid ] && kill "$(cat /tmp/novamind_frontend.pid)" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

start_backend
sleep 3
start_frontend

echo ""
echo "NovaMind running"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."
wait