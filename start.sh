#!/bin/bash
echo "============================================"
echo "  Chatbot RAG - Startup Script"
echo "============================================"
echo ""

# Check if Qdrant is running
echo "[1/3] Checking Qdrant..."
if ! curl -s http://localhost:6333/collections > /dev/null 2>&1; then
    echo "[!] Qdrant tidak berjalan. Silakan jalankan Docker dan Qdrant terlebih dahulu."
    echo "    Jalankan: docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant"
    exit 1
fi
echo "[OK] Qdrant sudah berjalan."
echo ""

# Check if Ollama is running
echo "[2/3] Checking Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "[!] Ollama tidak berjalan. Silakan jalankan Ollama terlebih dahulu."
    exit 1
fi
echo "[OK] Ollama sudah berjalan."
echo ""

# Start Backend and Frontend
echo "[3/3] Starting Backend and Frontend..."
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start Backend in background
echo "Starting Backend API (Port 3001)..."
cd "$SCRIPT_DIR/apps/api" && node server.mjs &

# Wait 2 seconds
sleep 2

# Start Frontend in background
echo "Starting Frontend Web (Port 3000)..."
cd "$SCRIPT_DIR/apps/web" && npm run dev &

echo ""
echo "============================================"
echo "  Semua layanan berhasil dijalankan!"
echo "============================================"
echo ""
echo "  Backend API : http://localhost:3001"
echo "  Frontend Web: http://localhost:3000"
echo ""

# Open browser (macOS/Linux)
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3000
elif command -v open > /dev/null; then
    open http://localhost:3000
fi

# Wait for processes
wait
