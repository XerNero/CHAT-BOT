# Panduan Setup & Instalasi

Dokumen ini berisi langkah-langkah lengkap untuk menjalankan proyek Chatbot RAG di device baru.

---

## 📋 Persyaratan Sistem

### Minimum Hardware
- **CPU**: 4 cores (8 cores recommended untuk Llama 13B)
- **RAM**: 16 GB (32 GB recommended)
- **Storage**: 50 GB free space
- **GPU**: Opsional (NVIDIA dengan CUDA untuk performa lebih baik)

### Sistem Operasi
- Windows 10/11 (64-bit)
- Linux (Ubuntu 20.04+)
- macOS (Apple Silicon atau Intel)

---

## 🔧 Software yang Perlu Diinstal

### 1. Node.js (v18 atau lebih baru)

**Download:** https://nodejs.org/

**Verifikasi instalasi:**
```bash
node --version    # Harus v18.x.x atau lebih
npm --version     # Harus v9.x.x atau lebih
```

**Alternatif (Windows):**
```powershell
winget install OpenJS.NodeJS.LTS
```

---

### 2. Docker Desktop

**Download:** https://www.docker.com/products/docker-desktop/

**Verifikasi instalasi:**
```bash
docker --version
docker-compose --version
```

**Catatan:**
- Windows: Pastikan WSL2 terinstal dan diaktifkan
- Beri Docker minimal 8GB RAM di Settings → Resources

---

### 3. Git (Opsional, untuk clone repo)

**Download:** https://git-scm.com/

```bash
git --version
```

---

## 🐳 Setup Infrastruktur (Docker)

### 1. Jalankan Qdrant (Vector Database)

```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

**Verifikasi:** Buka http://localhost:6333/dashboard

---

### 2. Jalankan Ollama (Local LLM)

**Download:** https://ollama.ai/download

**Setelah install, jalankan:**
```bash
ollama serve
```

**Download model Llama 3:**
```bash
ollama pull llama3:8b
```

**Verifikasi:**
```bash
ollama list
# Harus muncul: llama3:8b
```

**Cek Ollama running:**
```bash
curl http://localhost:11434/api/tags
```

---

## 📦 Setup Backend (Node.js API)

### 1. Clone/Copy Project

```bash
# Jika menggunakan Git
git clone <repository-url>
cd chatbot-rag

# Atau copy folder secara manual
```

### 2. Install Dependencies

```bash
cd apps/api
npm install
```

**Dependencies yang akan terinstal:**
- fastify
- @fastify/multipart
- @qdrant/js-client-rest
- undici
- pdf-parse

### 3. Jalankan Server

```bash
node server.mjs
```

**Output yang diharapkan:**
```
Server running on http://localhost:3001
```

**Verifikasi health check:**
```bash
curl http://localhost:3001/health
```

---

## 📄 Upload PDF (Ingestion)

### Menggunakan cURL

```bash
curl -X POST http://localhost:3001/ingest \
  -F "file=@/path/to/dokumen.pdf"
```

### Menggunakan PowerShell (Windows)

```powershell
$filePath = "C:\path\to\dokumen.pdf"
$uri = "http://localhost:3001/ingest"

$form = @{
    file = Get-Item -Path $filePath
}

Invoke-RestMethod -Uri $uri -Method Post -Form $form
```

**Response sukses:**
```json
{
  "ok": true,
  "chunks": 45,
  "message": "PDF ingested successfully"
}
```

---

## 💬 Test Chat

### Menggunakan Test Script (Recommended)

```bash
cd apps/api
node test-chat.mjs
```

### Menggunakan cURL

```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Apa saja layanan akademik yang tersedia?"}'
```

---

## 🔄 Urutan Startup yang Benar

Setiap kali mau menjalankan sistem:

```bash
# 1. Start Qdrant (jika belum running)
docker start qdrant

# 2. Start Ollama (jika belum running)
ollama serve

# 3. Start Backend API
cd apps/api
node server.mjs

# 4. (Nanti) Start Frontend
cd apps/web
npm run dev
```

---

## 🛑 Cara Mematikan Sistem

```bash
# Matikan semua proses Node.js
taskkill /F /IM node.exe

# Stop Qdrant
docker stop qdrant

# Stop Ollama (Ctrl+C di terminal atau)
taskkill /F /IM ollama.exe
```

---

## ❓ Troubleshooting

### Error: "Qdrant not reachable"
- Pastikan Docker Desktop running
- Cek: `docker ps` (harus ada container qdrant)
- Restart: `docker restart qdrant`

### Error: "Ollama not reachable"
- Pastikan `ollama serve` sudah jalan
- Cek: `curl http://localhost:11434/api/tags`
- Pastikan model sudah di-pull: `ollama pull llama3:8b`

### Error: "Bad Request" saat upload PDF
- Pastikan file adalah PDF valid
- Pastikan field name adalah "file"
- Cek ukuran file (max 25MB)

### Error: "Cannot find module"
- Jalankan `npm install` di folder `apps/api`

---

## 📞 Kontak Support

Jika ada masalah, hubungi:
- Email: [email@domain.com]
- WhatsApp: [nomor]
