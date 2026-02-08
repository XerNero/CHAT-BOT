# 🚀 PANDUAN INSTALASI LENGKAP

## Pertanyaan
> "Bagaimana cara install dan setup project ini dari awal?"

---

## 📋 DAFTAR SOFTWARE YANG DIBUTUHKAN

| Software | Fungsi | Link Download |
|----------|--------|---------------|
| **Docker Desktop** | Menjalankan Qdrant (Vector Database) | https://www.docker.com/products/docker-desktop |
| **Ollama** | LLM lokal untuk embedding & generation | https://ollama.com/download |
| **Node.js** | Runtime untuk server API & Next.js | https://nodejs.org (pilih LTS) |
| **pnpm** | Package manager | Otomatis via npm |
| **Git** | Clone repository (opsional) | https://git-scm.com/downloads |

---

# 📥 LANGKAH 1: INSTALL DOCKER

## Windows

1. Download **Docker Desktop** dari: https://www.docker.com/products/docker-desktop

2. Jalankan installer, ikuti wizard

3. Restart komputer jika diminta

4. Buka Docker Desktop, tunggu sampai running (icon hijau)

5. Test di terminal:
```bash
docker --version
# Output: Docker version 24.x.x
```

---

# 📥 LANGKAH 2: INSTALL OLLAMA

## Windows

1. Download dari: https://ollama.com/download

2. Jalankan installer

3. Buka terminal, download model llama3:
```bash
ollama pull llama3
```

4. Tunggu download (~4.7GB)

5. Test:
```bash
ollama run llama3 "Halo, apa kabar?"
# Harusnya menjawab dalam beberapa detik
```

6. **PENTING**: Biarkan Ollama berjalan di background

---

# 📥 LANGKAH 3: INSTALL NODE.JS

## Windows

1. Download dari: https://nodejs.org (pilih **LTS** version)

2. Jalankan installer, centang semua opsi default

3. Restart terminal

4. Test:
```bash
node --version
# Output: v20.x.x atau v22.x.x

npm --version
# Output: 10.x.x
```

---

# 📥 LANGKAH 4: INSTALL PNPM

Di terminal:

```bash
npm install -g pnpm
```

Test:
```bash
pnpm --version
# Output: 9.x.x atau 10.x.x
```

---

# 🔧 LANGKAH 5: SETUP PROJECT

## 5.1 Copy/Clone Project

**Opsi A: Copy folder**
- Copy folder `chatbot-rag` ke lokasi yang diinginkan

**Opsi B: Clone dari Git** (jika ada repository)
```bash
git clone <url-repository>
cd chatbot-rag
```

## 5.2 Install Dependencies API

```bash
cd chatbot-rag/apps/api
pnpm install
```

## 5.3 Install Dependencies Web

```bash
cd ../web
pnpm install
```

---

# 🐳 LANGKAH 6: JALANKAN QDRANT (DOCKER)

Buka terminal baru:

```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

**Penjelasan:**
- `-d` = jalankan di background
- `--name qdrant` = beri nama container "qdrant"
- `-p 6333:6333` = expose port untuk API
- `-p 6334:6334` = expose port untuk dashboard

**Test Qdrant:**
- Buka browser: http://localhost:6333/dashboard
- Harusnya muncul Qdrant Dashboard

---

# ▶️ LANGKAH 7: JALANKAN SERVER

## 7.1 Jalankan API Server

```bash
cd chatbot-rag/apps/api
node server.mjs
```

**Output yang diharapkan:**
```
Server listening at http://0.0.0.0:3001
Qdrant connected, collection ready
BM25 cache loaded: X points
```

## 7.2 Jalankan Frontend (Terminal Baru)

```bash
cd chatbot-rag/apps/web
pnpm dev
```

**Output yang diharapkan:**
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

---

# ✅ LANGKAH 8: TEST APLIKASI

1. Buka browser: http://localhost:3000

2. Upload PDF di sidebar

3. Tanya pertanyaan terkait PDF

4. Harusnya dapat jawaban dengan sitasi [#N]

---

# 🔄 CARA MENJALANKAN ULANG (Setiap Kali)

Setelah restart komputer:

```bash
# 1. Pastikan Docker Desktop running (buka aplikasi)

# 2. Jalankan Qdrant (jika belum jalan)
docker start qdrant

# 3. Pastikan Ollama running (buka aplikasi Ollama)

# 4. Jalankan API Server
cd chatbot-rag/apps/api
node server.mjs

# 5. Jalankan Frontend (terminal baru)
cd chatbot-rag/apps/web
pnpm dev
```

---

# 🛠️ TROUBLESHOOTING

## Error: "Qdrant connection refused"

```bash
# Cek apakah Docker running
docker ps

# Jika container tidak ada, jalankan ulang:
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# Jika container sudah ada tapi stopped:
docker start qdrant
```

## Error: "Ollama connection refused"

```bash
# Pastikan Ollama app running
# Atau jalankan dari terminal:
ollama serve
```

## Error: "Port 3001 already in use"

```bash
# Windows - cari dan kill process:
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```

## Error: "pnpm not found"

```bash
npm install -g pnpm
```

---

# 📊 RINGKASAN ARSITEKTUR

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARSITEKTUR SYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Browser (User)                                                            │
│       │                                                                      │
│       ▼                                                                      │
│   ┌─────────────────────┐                                                   │
│   │  Next.js Frontend   │ ← Port 3000                                       │
│   │  (apps/web)         │                                                   │
│   └──────────┬──────────┘                                                   │
│              │                                                               │
│              ▼                                                               │
│   ┌─────────────────────┐       ┌─────────────────────┐                    │
│   │  Node.js API        │──────▶│  Qdrant (Docker)    │                    │
│   │  (apps/api)         │       │  Port 6333          │                    │
│   │  Port 3001          │       └─────────────────────┘                    │
│   └──────────┬──────────┘                                                   │
│              │                                                               │
│              ▼                                                               │
│   ┌─────────────────────┐                                                   │
│   │  Ollama (LLM)       │                                                   │
│   │  Port 11434         │                                                   │
│   └─────────────────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# ✅ CHECKLIST INSTALASI

- [ ] Docker Desktop terinstall dan running
- [ ] Ollama terinstall dan model llama3 ter-download
- [ ] Node.js terinstall (v20+)
- [ ] pnpm terinstall
- [ ] Dependencies API ter-install (`pnpm install`)
- [ ] Dependencies Web ter-install (`pnpm install`)
- [ ] Qdrant container running (`docker start qdrant`)
- [ ] API Server running (`node server.mjs`)
- [ ] Frontend running (`pnpm dev`)
- [ ] Bisa akses http://localhost:3000
- [ ] Bisa upload PDF dan chat
