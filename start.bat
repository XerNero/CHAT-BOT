@echo off
chcp 65001 >nul
echo ============================================
echo   Chatbot RAG - Startup Script
echo ============================================
echo.

:: Check if Docker/Qdrant is running
echo [1/4] Checking Qdrant...
curl -s http://localhost:6333/collections > nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Qdrant tidak berjalan. Mencoba start container...
    docker start qdrant > nul 2>&1
    timeout /t 3 /nobreak > nul
    curl -s http://localhost:6333/collections > nul 2>&1
    if %errorlevel% neq 0 (
        echo [X] Gagal start Qdrant. Pastikan Docker Desktop berjalan.
        pause
        exit /b 1
    )
)
echo [OK] Qdrant sudah berjalan.
echo.

:: Check if Ollama is running
echo [2/4] Checking Ollama...
curl -s http://localhost:11434/api/tags > nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ollama tidak berjalan. Silakan buka aplikasi Ollama.
    pause
    exit /b 1
)
echo [OK] Ollama sudah berjalan.
echo.

:: Start Backend (WSL)
echo [3/4] Starting Backend API (Port 3001)...
start "Backend API" wsl -e bash -c "cd /mnt/e/chatbot-rag/apps/api && node server.mjs"

:: Wait for backend
timeout /t 5 /nobreak > nul

:: Start Frontend (Windows)
echo [4/4] Starting Frontend Web (Port 3000)...
start "Frontend Web" cmd /c "cd /d %~dp0apps\web && npm run dev"

:: Wait for frontend
timeout /t 8 /nobreak > nul

echo.
echo ============================================
echo   Semua layanan berhasil dijalankan!
echo ============================================
echo.
echo   Backend API : http://localhost:3001
echo   Frontend Web: http://localhost:3000
echo   Health Check: http://localhost:3001/health
echo.
echo   Tekan tombol apapun untuk membuka browser...
pause > nul

:: Open browser
start http://localhost:3000
