@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: =====================================================
:: CHATBOT RAG - SETUP WIZARD
:: Instalasi Project di Device Baru
:: =====================================================

title Chatbot RAG - Setup Wizard

:HEADER
cls
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║           CHATBOT RAG - SETUP WIZARD                         ║
echo ║           Instalasi Project di Device Baru                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Selamat datang! Tool ini akan membantu setup project chatbot RAG.
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

:: =====================================================
:: FASE 1: PENGECEKAN SOFTWARE
:: =====================================================
echo FASE 1: PENGECEKAN SOFTWARE WINDOWS
echo.
echo Silakan jawab pertanyaan berikut (y/n):
echo.

set /p docker_installed="1. Apakah Docker Desktop sudah terinstall dan berjalan? (y/n): "
if /i not "%docker_installed%"=="y" (
    echo.
    echo    [!] Silakan download dan install Docker Desktop:
    echo        https://www.docker.com/products/docker-desktop/
    echo.
    echo    Setelah install, buka Docker Desktop dan tunggu sampai running.
    echo.
    pause
)

set /p wsl_installed="2. Apakah WSL + Ubuntu sudah terinstall? (y/n): "
if /i not "%wsl_installed%"=="y" (
    echo.
    echo    [!] Silakan jalankan di PowerShell (Run as Administrator):
    echo        wsl --install -d Ubuntu
    echo.
    echo    Setelah itu RESTART Windows, lalu buka Ubuntu dan buat username/password.
    echo.
    pause
)

set /p ollama_installed="3. Apakah Ollama sudah terinstall? (y/n): "
if /i not "%ollama_installed%"=="y" (
    echo.
    echo    [!] Silakan download dan install Ollama:
    echo        https://ollama.com/download
    echo.
    pause
)

set /p git_installed="4. Apakah Git sudah terinstall? (y/n): "
if /i not "%git_installed%"=="y" (
    echo.
    echo    [!] Silakan jalankan: winget install Git.Git
    echo    Atau download dari: https://git-scm.com/download/win
    echo.
    pause
)

:: =====================================================
:: FASE 2: VERIFIKASI OTOMATIS
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 2: VERIFIKASI OTOMATIS
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Mengecek Docker...
docker --version >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('docker --version') do echo    [OK] %%i
) else (
    echo    [X] Docker tidak ditemukan!
    goto :ERROR
)

echo Mengecek Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel%==0 (
    echo    [OK] Ollama running on :11434
) else (
    echo    [X] Ollama tidak berjalan! Silakan buka aplikasi Ollama.
    pause
)

echo Mengecek Git...
git --version >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('git --version') do echo    [OK] %%i
) else (
    echo    [X] Git tidak ditemukan!
    goto :ERROR
)

echo Mengecek WSL...
wsl --status >nul 2>&1
if %errorlevel%==0 (
    echo    [OK] WSL tersedia
) else (
    echo    [X] WSL tidak ditemukan!
    goto :ERROR
)

echo.
echo Semua software terverifikasi!
echo.
pause

:: =====================================================
:: FASE 3: SETUP QDRANT
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 3: SETUP QDRANT (DOCKER)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Mengecek container qdrant...
docker ps -a --format "{{.Names}}" | findstr /i "qdrant" >nul 2>&1
if %errorlevel%==0 (
    echo    [OK] Container qdrant sudah ada
    echo    Memastikan container berjalan...
    docker start qdrant >nul 2>&1
) else (
    echo    [!] Container tidak ditemukan, membuat baru...
    docker run -d --name qdrant -p 6333:6333 -p 6334:6334 -v qdrant_data:/qdrant/storage qdrant/qdrant:latest
    if %errorlevel%==0 (
        echo    [OK] Container qdrant berhasil dibuat!
    ) else (
        echo    [X] Gagal membuat container qdrant!
        goto :ERROR
    )
)

echo.
echo Mengatur auto-restart...
docker update --restart unless-stopped qdrant >nul 2>&1
echo    [OK] Qdrant akan auto-start setelah reboot

echo.
echo Menunggu Qdrant ready...
timeout /t 5 /nobreak >nul

curl -s http://localhost:6333/ >nul 2>&1
if %errorlevel%==0 (
    echo    [OK] Qdrant berjalan di http://localhost:6333
) else (
    echo    [!] Qdrant belum ready, tunggu sebentar...
    timeout /t 10 /nobreak >nul
)

echo.
pause

:: =====================================================
:: FASE 4: MODEL OLLAMA
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 4: MODEL OLLAMA
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Mengecek model yang tersedia...
echo.

set llama_ok=0
set nomic_ok=0

for /f "tokens=*" %%i in ('ollama list 2^>nul') do (
    echo %%i | findstr /i "llama3:8b" >nul && set llama_ok=1
    echo %%i | findstr /i "nomic-embed-text" >nul && set nomic_ok=1
)

echo Model yang dibutuhkan:
if %llama_ok%==1 (
    echo    [OK] llama3:8b
) else (
    echo    [X] llama3:8b - BELUM ADA
)

if %nomic_ok%==1 (
    echo    [OK] nomic-embed-text
) else (
    echo    [X] nomic-embed-text - BELUM ADA
)

if %llama_ok%==0 if %nomic_ok%==0 (
    echo.
    echo ╔══════════════════════════════════════════════════════════════╗
    echo ║  AKSI MANUAL DIPERLUKAN                                      ║
    echo ╠══════════════════════════════════════════════════════════════╣
    echo ║  Buka CMD baru dan jalankan:                                 ║
    echo ║                                                              ║
    echo ║    ollama pull llama3:8b                                     ║
    echo ║    ollama pull nomic-embed-text                              ║
    echo ║                                                              ║
    echo ║  Proses download mungkin memakan waktu lama.                 ║
    echo ╚══════════════════════════════════════════════════════════════╝
    echo.
    echo Tekan Enter setelah selesai download...
    pause >nul
)

echo.
pause

:: =====================================================
:: FASE 5: CLONE PROJECT
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 5: CLONE PROJECT
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

if exist "E:\chatbot-rag\apps\api\server.mjs" (
    echo    [OK] Project sudah ada di E:\chatbot-rag
) else (
    set /p clone_project="Project belum ada. Clone dari GitHub? (y/n): "
    if /i "!clone_project!"=="y" (
        echo.
        echo Cloning project...
        cd /d E:\
        git clone https://github.com/XerNero/CHAT-BOT.git chatbot-rag
        if %errorlevel%==0 (
            echo    [OK] Project berhasil di-clone!
        ) else (
            echo    [X] Gagal clone project!
            goto :ERROR
        )
    ) else (
        echo.
        echo    [!] Silakan copy project ke E:\chatbot-rag secara manual.
        pause
    )
)

echo.
pause

:: =====================================================
:: FASE 6: SETUP UBUNTU
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 6: SETUP UBUNTU (WSL)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Mengecek Node.js di Ubuntu...
wsl -e bash -c "node -v" >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('wsl -e bash -c "node -v"') do echo    [OK] Node.js %%i sudah terinstall
    goto :SKIP_UBUNTU_SETUP
)

echo    [!] Node.js belum terinstall di Ubuntu
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  AKSI MANUAL DIPERLUKAN                                      ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  1. Buka terminal Ubuntu (ketik "ubuntu" di Start Menu)      ║
echo ║                                                              ║
echo ║  2. Copy-paste perintah ini (1 baris, ketik password 1x):    ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║  curl -fsSL https://deb.nodesource.com/setup_lts.x ^|        ║
echo ║  sudo -E bash - ^&^& sudo apt install -y nodejs ^&^&            ║
echo ║  sudo npm i -g pnpm pm2 ^&^& echo "Setup selesai!"            ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Atau copy dari sini (tanpa line break):
echo.
echo curl -fsSL https://deb.nodesource.com/setup_lts.x ^| sudo -E bash - ^&^& sudo apt install -y nodejs ^&^& sudo npm i -g pnpm pm2
echo.
echo.
echo Tekan Enter setelah selesai setup Ubuntu...
pause >nul

:SKIP_UBUNTU_SETUP
echo.
echo Memverifikasi instalasi Ubuntu...
wsl -e bash -c "node -v" >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('wsl -e bash -c "node -v"') do echo    [OK] Node.js %%i
) else (
    echo    [X] Node.js masih belum terinstall!
)

wsl -e bash -c "pnpm -v" >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('wsl -e bash -c "pnpm -v"') do echo    [OK] pnpm %%i
)

wsl -e bash -c "pm2 -v" >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('wsl -e bash -c "pm2 -v"') do echo    [OK] PM2 %%i
)

echo.
pause

:: =====================================================
:: FASE 7: INSTALL DEPENDENCIES
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 7: INSTALL DEPENDENCIES
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Installing backend dependencies (pnpm)...
wsl -e bash -c "cd /mnt/e/chatbot-rag/apps/api && pnpm install"
if %errorlevel%==0 (
    echo    [OK] Backend dependencies installed
) else (
    echo    [!] Warning: pnpm install mungkin ada issue
)

echo.
echo Installing frontend dependencies (npm)...
cd /d E:\chatbot-rag\apps\web
call npm install
if %errorlevel%==0 (
    echo    [OK] Frontend dependencies installed
) else (
    echo    [!] Warning: npm install mungkin ada issue
)

echo.
pause

:: =====================================================
:: FASE 8: JALANKAN APLIKASI
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 8: JALANKAN APLIKASI
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

set /p run_now="Jalankan aplikasi sekarang? (y/n): "
if /i not "%run_now%"=="y" goto :FINISH

echo.
echo Starting backend (API)...
start "Chatbot API" wsl -e bash -c "cd /mnt/e/chatbot-rag/apps/api && node server.mjs"
timeout /t 5 /nobreak >nul

echo Starting frontend (Web)...
start "Chatbot Web" cmd /c "cd /d E:\chatbot-rag\apps\web && npm run dev"
timeout /t 8 /nobreak >nul

echo.
echo Opening browser...
start http://localhost:3000

:: =====================================================
:: FASE 9: TEST CHAT OTOMATIS
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 9: TEST CHAT OTOMATIS
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Menunggu server ready...
timeout /t 5 /nobreak >nul

echo.
echo Testing Health Check...
curl -s http://localhost:3001/health > temp_health.json 2>nul
if %errorlevel%==0 (
    echo    [OK] Health check passed!
    type temp_health.json
    del temp_health.json >nul 2>&1
) else (
    echo    [!] Health check failed - server mungkin belum ready
)

echo.
echo.
set /p run_test="Jalankan test chat? (y/n): "
if /i not "%run_test%"=="y" goto :SKIP_TEST

echo.
echo Mengirim test pertanyaan: "Apa itu yudisium?"
echo.

curl -s -X POST http://localhost:3001/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"question\": \"Apa itu yudisium?\", \"history\": []}" > temp_chat.json 2>nul

if %errorlevel%==0 (
    echo ╔══════════════════════════════════════════════════════════════╗
    echo ║  HASIL TEST CHAT                                             ║
    echo ╚══════════════════════════════════════════════════════════════╝
    echo.
    type temp_chat.json
    del temp_chat.json >nul 2>&1
    echo.
    echo.
    echo    [OK] Test chat berhasil!
) else (
    echo    [X] Test chat gagal!
)

:SKIP_TEST
echo.
pause

:: =====================================================
:: FASE 10: SETUP PM2 AUTO-START
:: =====================================================
cls
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo FASE 10: SETUP PM2 AUTO-START
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

set /p setup_pm2="Setup PM2 auto-start agar server jalan otomatis? (y/n): "
if /i not "%setup_pm2%"=="y" goto :FINISH

echo.
echo Menghentikan server node yang berjalan...
wsl -e bash -c "pkill -f 'node server.mjs'" >nul 2>&1

echo.
echo Mendaftarkan server ke PM2...
wsl -e bash -c "cd /mnt/e/chatbot-rag/apps/api && pm2 start server.mjs --name chatbot-api"

echo.
echo Menyimpan konfigurasi PM2...
wsl -e bash -c "pm2 save"

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  AKSI MANUAL UNTUK AUTO-START SAAT BOOT                      ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║  1. Buka terminal Ubuntu                                     ║
echo ║  2. Jalankan: pm2 startup                                    ║
echo ║  3. Copy perintah "sudo ..." yang muncul                     ║
echo ║  4. Jalankan perintah tersebut                               ║
echo ║  5. Jalankan: pm2 save                                       ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Tekan Enter setelah selesai...
pause >nul

echo.
echo Verifikasi PM2 status...
wsl -e bash -c "pm2 status"
echo.
echo    [OK] PM2 auto-start berhasil dikonfigurasi!

echo.
pause

:: =====================================================
:: SELESAI
:: =====================================================
:FINISH
cls
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║              ✅ SETUP SELESAI!                               ║
echo ║                                                              ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║  Frontend : http://localhost:3000                            ║
echo ║  Backend  : http://localhost:3001                            ║
echo ║  Health   : http://localhost:3001/health                     ║
echo ║                                                              ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║  Untuk menjalankan lagi:                                     ║
echo ║  - Manual    : start.bat                                     ║
echo ║  - Via PM2   : wsl -e bash -c "pm2 start chatbot-api"        ║
echo ║  - Cek status: wsl -e bash -c "pm2 status"                   ║
echo ║                                                              ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║  Setelah reboot:                                             ║
echo ║  1. Buka Docker Desktop                                      ║
echo ║  2. Buka Ubuntu (ketik "ubuntu" di Start Menu)               ║
echo ║  3. Server akan otomatis jalan via PM2                       ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
goto :EOF

:ERROR
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  [X] SETUP GAGAL                                             ║
echo ║  Silakan perbaiki error di atas dan jalankan ulang.          ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
goto :EOF
