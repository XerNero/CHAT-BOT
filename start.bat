@echo off
echo ============================================
echo   Chatbot RAG - Startup Script
echo ============================================
echo.

:: Check if Qdrant is running
echo [1/3] Checking Qdrant...
curl -s http://localhost:6333/collections > nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Qdrant tidak berjalan. Silakan jalankan Docker Desktop dan Qdrant terlebih dahulu.
    echo     Jalankan: docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
    pause
    exit /b 1
)
echo [OK] Qdrant sudah berjalan.
echo.

:: Check if Ollama is running
echo [2/3] Checking Ollama...
curl -s http://localhost:11434/api/tags > nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ollama tidak berjalan. Silakan jalankan Ollama terlebih dahulu.
    pause
    exit /b 1
)
echo [OK] Ollama sudah berjalan.
echo.

:: Start Backend and Frontend
echo [3/3] Starting Backend and Frontend...
echo.

:: Start Backend in new window
echo Starting Backend API (Port 3001)...
start "Backend API" cmd /k "cd /d %~dp0apps\api && node server.mjs"

:: Wait 2 seconds
timeout /t 2 /nobreak > nul

:: Start Frontend in new window
echo Starting Frontend Web (Port 3000)...
start "Frontend Web" cmd /k "cd /d %~dp0apps\web && npm run dev"

echo.
echo ============================================
echo   Semua layanan berhasil dijalankan!
echo ============================================
echo.
echo   Backend API : http://localhost:3001
echo   Frontend Web: http://localhost:3000
echo.
echo   Tekan tombol apapun untuk membuka browser...
pause > nul

:: Open browser
start http://localhost:3000
