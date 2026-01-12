# Panduan Menjalankan Program

---

## 🚀 Quick Start (5 Menit)

### Prasyarat
Pastikan sudah terinstal:
- ✅ Docker Desktop (running)
- ✅ Node.js v18+
- ✅ Ollama dengan model llama3:8b

---

## 📋 Langkah-Langkah Menjalankan

### Step 1: Start Qdrant (Vector Database)

```bash
# Jika pertama kali
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# Jika sudah pernah dibuat
docker start qdrant
```

**Cek:** http://localhost:6333/dashboard

---

### Step 2: Start Ollama (LLM Server)

Buka terminal baru:
```bash
ollama serve
```

Biarkan terminal ini tetap terbuka.

**Cek:** `curl http://localhost:11434/api/tags`

---

### Step 3: Start Backend API

Buka terminal baru:
```bash
cd E:\chatbot-rag\apps\api
node server.mjs
```

**Output:**
```
Server running on http://localhost:3001
```

---

### Step 4: Upload PDF (Sekali Saja)

Jika belum pernah upload PDF:

```bash
# Windows PowerShell
cd E:\chatbot-rag\apps\api

# Upload PDF
# (Ganti path sesuai lokasi PDF kamu)
curl.exe -X POST http://localhost:3001/ingest -F "file=@C:\path\to\dokumen.pdf"
```

---

### Step 5: Test Chat

```bash
cd E:\chatbot-rag\apps\api
node test-chat.mjs
```

Atau manual:

```bash
curl.exe -X POST http://localhost:3001/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"question\": \"Apa saja layanan akademik yang tersedia?\"}"
```

---

## 🔄 Startup Harian

Setiap kali mau pakai (setelah restart PC):

```bash
# Terminal 1: Qdrant
docker start qdrant

# Terminal 2: Ollama
ollama serve

# Terminal 3: Backend
cd E:\chatbot-rag\apps\api
node server.mjs
```

---

## 🛑 Shutdown

```bash
# Matikan semua Node.js
taskkill /F /IM node.exe

# Stop Qdrant
docker stop qdrant

# Stop Ollama (Ctrl+C atau)
taskkill /F /IM ollama.exe
```

---

## 📊 Endpoints yang Tersedia

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/health` | Cek status sistem |
| POST | `/ingest` | Upload PDF baru |
| POST | `/chat` | Kirim pertanyaan |

---

## 💡 Tips

1. **Jangan tutup terminal Ollama** - LLM perlu tetap running
2. **Upload PDF sekali saja** - Data tersimpan di Qdrant
3. **Restart jika error** - Matikan semua, start ulang dari Qdrant
4. **Check health dulu** - `curl http://localhost:3001/health`
