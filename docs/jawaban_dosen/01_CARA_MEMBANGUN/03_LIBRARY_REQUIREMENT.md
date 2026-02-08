# Pertanyaan 6: Apa Requirement/Library yang Dipakai?

## Pertanyaan Dosen
> "Kita butuh requirement-nya apa? RAG kamu menggunakan library apa, dan bagaimana cara menempatkan?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, ini requirement yang saya pakai:**

| Kategori | Tools |
|----------|-------|
| **Backend** | Node.js + Fastify + pdf-parse |
| **AI** | Ollama (llama3:8b) |
| **Database** | Qdrant (Vector DB) |
| **Frontend** | Next.js (React) |

**Semua bisa dijalankan LOKAL, tidak perlu API berbayar."**

---

## 📖 Daftar Library Lengkap

### Backend (Node.js)

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 1-23

```javascript
// Baris 1 - HTTP Server Framework
import Fastify from "fastify";

// Baris 2 - Qdrant Vector Database Client
import { QdrantClient } from "@qdrant/js-client-rest";

// Baris 3 - HTTP Client untuk request ke Ollama
import { request } from "undici";

// Baris 4 - Handler untuk file upload
import multipart from "@fastify/multipart";

// Baris 5 & 10-11 - PDF Parser
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParseMod = require("pdf-parse");
```

---

### Tabel Library Backend

| Library | Versi | Fungsi | Baris Import |
|---------|-------|--------|--------------|
| `fastify` | 5.x | HTTP server framework, lebih cepat dari Express | 1 |
| `@qdrant/js-client-rest` | 1.12+ | Client untuk koneksi ke Qdrant database | 2 |
| `undici` | 6.x | HTTP client native Node.js, untuk request ke Ollama | 3 |
| `@fastify/multipart` | 9.x | Handle file upload (PDF) via form-data | 4 |
| `pdf-parse` | 1.1.1 | Ekstraksi teks dari file PDF | 10-11 |

---

### Konfigurasi Services

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 54-68

```javascript
// Windows Host (untuk WSL)
const WIN_HOST = process.env.WIN_HOST || "172.17.112.1";

// Qdrant Client
const qdrant = new QdrantClient({
  url: `http://${WIN_HOST}:6333`,    // Port default Qdrant
  checkCompatibility: false,
});

// Ollama URL
const OLLAMA_URL = `http://${WIN_HOST}:11434`;  // Port default Ollama

// Collection name di Qdrant
const COLLECTION_NAME = "pdf_chunks";

// Model AI
const CHAT_MODEL = "llama3:8b";   // Untuk generate jawaban
const EMBED_MODEL = "llama3:8b"; // Untuk embedding
```

---

### External Services

| Service | Port | Fungsi | URL |
|---------|------|--------|-----|
| **Ollama** | 11434 | LLM lokal + Embedding | `http://localhost:11434` |
| **Qdrant** | 6333 | Vector Database | `http://localhost:6333` |

---

### Model AI

| Model | Fungsi | Dimensi Embedding |
|-------|--------|-------------------|
| `llama3:8b` | Chat (generate jawaban) | - |
| `llama3:8b` | Embedding (teks → vektor) | 4096 |

**Kenapa llama3:8b?**
- ✅ Cukup kuat untuk bahasa Indonesia
- ✅ Bisa dijalankan di GPU consumer (8GB VRAM)
- ✅ Gratis dan open source
- ✅ Bisa embedding dan chat (1 model, 2 fungsi)

---

## 📦 Struktur package.json

**📁 File:** `apps/api/package.json`

```json
{
  "name": "chatbot-rag-api",
  "type": "module",
  "scripts": {
    "start": "node server.mjs",
    "dev": "node --watch server.mjs"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@qdrant/js-client-rest": "^1.12.0",
    "undici": "^6.0.0",
    "@fastify/multipart": "^9.0.0",
    "pdf-parse": "^1.1.1"
  }
}
```

---

## 📊 Diagram Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                      SYSTEM ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    FRONTEND                              │    │
│  │                    (Next.js)                             │    │
│  │                    Port 3000                             │    │
│  │                                                          │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │ React Components + Markdown Renderer              │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │ HTTP Requests                        │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      BACKEND                             │    │
│  │                 (Node.js + Fastify)                      │    │
│  │                      Port 3001                           │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │                ENDPOINTS                         │    │    │
│  │  │  /health | /docs | /ingest | /chat | /chat-multihop  │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │              LIBRARIES                           │    │    │
│  │  │  pdf-parse | undici | @qdrant/js-client-rest    │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └──────────────────┬───────────────────┬──────────────────┘    │
│                     │                   │                        │
│                     ▼                   ▼                        │
│  ┌────────────────────────┐    ┌────────────────────────┐       │
│  │        OLLAMA          │    │        QDRANT          │       │
│  │      Port 11434        │    │       Port 6333        │       │
│  │                        │    │                        │       │
│  │  ┌──────────────────┐  │    │  ┌──────────────────┐  │       │
│  │  │ Model: llama3:8b │  │    │  │ Collection:      │  │       │
│  │  │                  │  │    │  │ "pdf_chunks"     │  │       │
│  │  │ - Chat           │  │    │  │                  │  │       │
│  │  │ - Embedding      │  │    │  │ - Vectors (4096d)│  │       │
│  │  └──────────────────┘  │    │  │ - Metadata       │  │       │
│  └────────────────────────┘    │  └──────────────────┘  │       │
│                                └────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Cara Install

### Step 1: Install External Services

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Atau download dari https://ollama.com untuk Windows

# Pull model
ollama pull llama3:8b

# Start Ollama
ollama serve
```

```bash
# Start Qdrant dengan Docker
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant
```

### Step 2: Install Backend

```bash
cd apps/api
pnpm install  # atau npm install
```

### Step 3: Install Frontend

```bash
cd apps/web
npm install
```

### Step 4: Jalankan

```bash
# Terminal 1 - Backend
cd apps/api
node server.mjs

# Terminal 2 - Frontend
cd apps/web
npm run dev
```

---

## 🗂️ Struktur Folder Proyek

```
chatbot-rag/
├── apps/
│   ├── api/                    # Backend
│   │   ├── server.mjs          # Main server file
│   │   ├── package.json        # Dependencies
│   │   ├── ingest_all.mjs      # Script ingest PDF
│   │   └── pdfs/               # Folder untuk PDF
│   │
│   └── web/                    # Frontend
│       ├── src/
│       │   └── app/
│       │       └── page.tsx    # Main page
│       ├── package.json
│       └── next.config.js
│
├── docs/                       # Dokumentasi
│   ├── jawaban_dosen/
│   ├── todolist/
│   └── *.md
│
├── start.bat                   # Script start Windows
├── start.sh                    # Script start Linux
└── README.md
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, ini requirement yang saya gunakan:"**

1. **"Backend pakai Node.js dengan Fastify"** (baris 1)
   - Fastify lebih cepat dari Express
   - Cocok untuk API

2. **"Untuk parsing PDF, saya pakai pdf-parse"** (baris 10-11)
   - Library ringan
   - Bisa ekstrak teks dari PDF

3. **"Untuk AI, saya pakai Ollama"** (baris 63)
   - Model llama3:8b
   - Bisa dijalankan lokal
   - Gratis, tidak perlu API key

4. **"Untuk database vektor, saya pakai Qdrant"** (baris 58)
   - Open source
   - Performant untuk vector search
   - Jalan di Docker

5. **"Frontend pakai Next.js"**
   - React-based
   - Render Markdown

**"Semua bisa dijalankan LOKAL, Pak. Tidak ada biaya API."**

---

## ✅ Checklist Pemahaman

- [ ] Bisa sebutkan semua library dan fungsinya
- [ ] Bisa jelaskan kenapa pilih library tersebut
- [ ] Bisa tunjukkan baris import di kode
- [ ] Bisa jelaskan arsitektur sistem
- [ ] Bisa jelaskan cara install dan jalankan
