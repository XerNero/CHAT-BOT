# Panduan Instalasi & Setup Project dari Nol
## Windows 10/11 + WSL (Ubuntu) + Docker Desktop + Qdrant + Ollama + PM2

---

## 📋 Ringkasan

Panduan ini untuk **memindahkan project ke device baru** dan menjalankan:
- ✅ Qdrant (Docker di Windows)
- ✅ Ollama (Windows)
- ✅ API Server (Node di Ubuntu/WSL) dengan PM2
- ✅ Auto-start setelah reboot

> **💡 TIP:** Gunakan **`setup-wizard.bat`** untuk instalasi otomatis dengan panduan interaktif!
> Jalankan file tersebut dan ikuti instruksi di layar.

> **Catatan:** Setelah reboot Windows, WSL baru aktif setelah kamu membuka terminal Ubuntu minimal 1x.

---

## A. WINDOWS — Download & Install (WAJIB)

### 1. Install Docker Desktop

- Download: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- Saat install, centang **"Use WSL2"** jika ada opsinya
- Setelah install, buka Docker Desktop

### 2. Install WSL + Ubuntu

Buka **PowerShell (Run as Administrator)**, jalankan:

```powershell
wsl --install
wsl --install -d Ubuntu
```

**RESTART Windows** setelah perintah di atas.

Saat pertama buka Ubuntu:
- Buat username: `dmin` (atau sesuai keinginan)
- Buat password (simpan baik-baik)

### 3. Install Ollama for Windows

- Download: [Ollama for Windows](https://ollama.com/download)
- Install dan jalankan Ollama

Verifikasi Ollama:
```cmd
curl http://localhost:11434/api/tags
```

Download model LLM dan Embedding:
```cmd
ollama pull llama3:8b
ollama pull nomic-embed-text
```

Verifikasi model terdownload:
```cmd
ollama list
```

### 4. Install Git (Jika Belum Ada)

```cmd
winget install Git.Git
```

Atau download dari: [Git for Windows](https://git-scm.com/download/win)

### 5. Verifikasi Docker Desktop

Pastikan Docker Desktop sudah jalan:
```cmd
docker version
docker ps
```

---

## B. WINDOWS — Jalankan Qdrant (Docker)

### Pertama Kali (Buat Container)

```cmd
docker run -d --name qdrant ^
  -p 6333:6333 -p 6334:6334 ^
  -v qdrant_data:/qdrant/storage ^
  qdrant/qdrant:latest
```

### Jika Container Sudah Ada

Jika error "container name already in use":
```cmd
docker start qdrant
```

### Test Qdrant

```cmd
curl http://localhost:6333/
```

---

## C. UBUNTU (WSL) — Install Node + pnpm + PM2

### 1. Update Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js (LTS)

```bash
sudo apt install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 3. Install pnpm

```bash
sudo npm i -g pnpm
pnpm -v
```

### 4. Install PM2

```bash
sudo npm install -g pm2
pm2 -v
```

---

## D. Clone Project dari GitHub

### Opsi 1: Clone dari GitHub (Rekomendasi)

**Windows (CMD):**
```cmd
cd E:\
git clone https://github.com/XerNero/CHAT-BOT.git chatbot-rag
```

### Opsi 2: Copy Manual

Jika tidak pakai GitHub, copy folder project ke `E:\chatbot-rag`

### Lokasi Project

- Windows: `E:\chatbot-rag`
- WSL path: `/mnt/e/chatbot-rag`

---

## E. Install Dependencies

### 1. Backend (API)

```bash
cd /mnt/e/chatbot-rag/apps/api
pnpm install
```

### 2. Frontend (Web)

```bash
cd /mnt/e/chatbot-rag/apps/web
npm install
```

---

## F. Konfigurasi WIN_HOST (PENTING!)

Di WSL, `127.0.0.1` tidak mengarah ke Windows. Harus pakai IP gateway.

### Cari IP Gateway

```bash
ip route | grep default
```

Contoh output:
```
default via 172.17.112.1 dev eth0
```

Berarti **WIN_HOST = 172.17.112.1**

> **Catatan:** IP ini sudah otomatis dideteksi oleh `server.mjs` versi terbaru. Jika masih error, edit manual di `server.mjs`.

---

## G. Jalankan Aplikasi

### 1. Jalankan Backend (API)

**Terminal 1 (WSL):**
```bash
cd /mnt/e/chatbot-rag/apps/api
node server.mjs
```

### 2. Jalankan Frontend (Web)

**Terminal 2 (Windows CMD):**
```cmd
cd E:\chatbot-rag\apps\web
npm run dev
```

### 3. Akses di Browser

Buka browser dan akses:
- **Frontend (User Interface):** http://localhost:3000
- **Backend Health Check:** http://localhost:3001/health

---

## H. Test Health Check

```bash
curl http://127.0.0.1:3001/health
```

Expected output:
```json
{
  "ok": true,
  "win_host": "172.17.112.1",
  "qdrant": { "ok": true },
  "ollama": { "ok": true }
}
```

---

## I. Ingest PDF (Windows CMD)

```cmd
curl -X POST http://localhost:3001/ingest ^
  -F "file=@E:\chatbot-rag\data\pdf\NamaDokumen.pdf"
```

---

## J. Test Chat

Buat file `test-chat.mjs`:

```javascript
import { request } from "undici";

async function testChat() {
  const { body, statusCode } = await request("http://127.0.0.1:3001/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: "Apa saja layanan akademik yang tersedia di kampus?",
      history: [],
    }),
  });

  const res = await body.json();
  console.log("Status:", statusCode);
  console.log(JSON.stringify(res, null, 2));
}

testChat().catch(console.error);
```

Jalankan:
```bash
node test-chat.mjs
```

---

## K. Auto-Start Configuration

### 1. Auto-Start Qdrant (Docker)

Buka Docker Desktop Settings:
- ✅ Enable "Start Docker Desktop when you log in"

Set restart policy untuk container:
```cmd
docker update --restart unless-stopped qdrant
```

### 2. Auto-Start Server via PM2

```bash
cd /mnt/e/chatbot-rag/apps/api
pm2 start server.mjs --name chatbot-api
pm2 save
pm2 status
```

### 3. PM2 Auto-Boot saat WSL Start

```bash
pm2 startup
```

PM2 akan menampilkan command `sudo ...` — **COPY dan jalankan command itu**.

Kemudian:
```bash
pm2 save
```

---

## L. Checklist Setelah Reboot

### Windows (CMD)

```cmd
docker ps
curl http://localhost:6333/
curl http://localhost:11434/api/tags
```

### Ubuntu (WSL)

```bash
pm2 status
curl http://127.0.0.1:3001/health
```

---

## M. Troubleshooting

### 1. `/health` Error: fetch failed

WSL tidak bisa akses Ollama/Qdrant di Windows.

**Solusi:**
```bash
ip route | grep default
```
Update `WIN_HOST` di `server.mjs` sesuai output.

### 2. Qdrant Tidak Jalan

```cmd
docker start qdrant
curl http://localhost:6333/
```

### 3. Ollama Tidak Jalan

```cmd
curl -v http://localhost:11434/api/tags
```

Jika "connection refused", buka aplikasi Ollama atau restart service.

### 4. Lihat Log Server (PM2)

```bash
pm2 logs chatbot-api --lines 200
```

### 5. Restart Server

```bash
pm2 restart chatbot-api
```

---

## N. Perintah Cepat

| Tugas | Perintah |
|-------|----------|
| Start Qdrant | `docker start qdrant` |
| Stop Qdrant | `docker stop qdrant` |
| Start API (PM2) | `pm2 start chatbot-api` |
| Stop API (PM2) | `pm2 stop chatbot-api` |
| Restart API | `pm2 restart chatbot-api` |
| Lihat Log | `pm2 logs chatbot-api` |
| Status PM2 | `pm2 status` |

---

## ✅ Selesai!

Yang perlu diubah di device baru:
1. **WIN_HOST** di `server.mjs` — sesuaikan dengan output `ip route | grep default`

---

*Terakhir diperbarui: 12 Januari 2026*
