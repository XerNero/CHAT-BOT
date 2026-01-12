#!/bin/bash
echo "============================================"
echo "  Chatbot RAG - Startup Script (Linux/WSL)"
echo "============================================"
echo ""

# Get Windows Host IP (for WSL)
WIN_HOST=$(ip route | grep default | awk '{print $3}')
if [ -z "$WIN_HOST" ]; then
    WIN_HOST="localhost"
fi
echo "Detected WIN_HOST: $WIN_HOST"
echo ""

# Check if Qdrant is running
echo "[1/4] Checking Qdrant..."
if ! curl -s "http://$WIN_HOST:6333/collections" > /dev/null 2>&1; then
    echo "[!] Qdrant tidak berjalan di $WIN_HOST:6333"
    echo "    Pastikan Docker Desktop dan container Qdrant berjalan di Windows."
    exit 1
fi
echo "[OK] Qdrant sudah berjalan."
echo ""

# Check if Ollama is running
echo "[2/4] Checking Ollama..."
if ! curl -s "http://$WIN_HOST:11434/api/tags" > /dev/null 2>&1; then
    echo "[!] Ollama tidak berjalan di $WIN_HOST:11434"
    echo "    Pastikan Ollama berjalan di Windows."
    exit 1
fi
echo "[OK] Ollama sudah berjalan."
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start Backend
echo "[3/4] Starting Backend API (Port 3001)..."
cd "$SCRIPT_DIR/apps/api" && node server.mjs &
BACKEND_PID=$!

# Wait for backend
sleep 5

# Check if backend started
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "[OK] Backend API running on :3001"
else
    echo "[!] Backend mungkin masih loading..."
fi

# Start Frontend
echo "[4/4] Starting Frontend Web (Port 3000)..."
cd "$SCRIPT_DIR/apps/web" && npm run dev &
FRONTEND_PID=$!

# Wait for frontend
sleep 5

echo ""
echo "============================================"
echo "  Semua layanan berhasil dijalankan!"
echo "============================================"
echo ""
echo "  Backend API : http://localhost:3001"
echo "  Frontend Web: http://localhost:3000"
echo "  Health Check: http://localhost:3001/health"
echo ""
echo "  WIN_HOST    : $WIN_HOST"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Open browser (if available)
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3000
elif command -v open > /dev/null; then
    open http://localhost:3000
fi

# Trap Ctrl+C to cleanup
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for processes
wait
