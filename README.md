# 🤖 Chatbot RAG - Asisten Kampus Berbasis Dokumen

![Status](https://img.shields.io/badge/Status-Complete-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-Academic-orange)

## 📋 Deskripsi Proyek

Chatbot berbasis website yang menjawab pertanyaan pengguna **hanya berdasarkan isi file PDF**. Sistem ini menggunakan **Hybrid RAG (Retrieval-Augmented Generation)** dengan mekanisme anti-halusinasi untuk memastikan jawaban akurat dan dapat diverifikasi.

### ✨ Fitur Utama
- 🔍 **Hybrid RAG** - Kombinasi Vector Search + BM25 + RRF Fusion
- 🔀 **Multi-hop Query** - Dekomposisi pertanyaan kompleks menjadi 4 sub-query
- �️ **Anti-Halusinasi** - Sitasi wajib [#N], menolak jika tidak ada data
- 📄 **PDF-based** - Jawaban HANYA dari dokumen yang di-upload
- 🇮🇩 **Bahasa Indonesia** - Optimized untuk Bahasa Indonesia
- 🧠 **AI Lokal (Offline)** - Menggunakan Ollama, tidak perlu internet

---

## 🏗 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARSITEKTUR SISTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   User (Browser)                                                            │
│       │                                                                      │
│       ▼                                                                      │
│   ┌─────────────────────┐                                                   │
│   │  Next.js Frontend   │  ← Port 3000                                      │
│   │  (Chat UI)          │                                                   │
│   └──────────┬──────────┘                                                   │
│              │                                                               │
│              ▼                                                               │
│   ┌─────────────────────┐       ┌─────────────────────┐                    │
│   │  Fastify API        │──────▶│  Qdrant (Docker)    │                    │
│   │  (server.mjs)       │       │  Vector Database    │                    │
│   │  Port 3001          │       │  Port 6333          │                    │
│   └──────────┬──────────┘       └─────────────────────┘                    │
│              │                                                               │
│              ▼                                                               │
│   ┌─────────────────────┐                                                   │
│   │  Ollama (LLM)       │                                                   │
│   │  llama3:8b          │                                                   │
│   │  Port 11434         │                                                   │
│   └─────────────────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Teknologi | Fungsi |
|-------|-----------|--------|
| **Frontend** | Next.js 16 + React | UI Chat |
| **Backend** | Node.js + Fastify | REST API |
| **Vector DB** | Qdrant (Docker) | Penyimpanan embedding |
| **LLM** | Ollama + llama3:8b | Embedding & Generation |
| **PDF Parser** | pdf-parse | Ekstraksi teks PDF |
| **Retrieval** | Hybrid RAG | Vector + BM25 + RRF |

---

## 📁 Struktur Folder

```
chatbot-rag/
├── apps/
│   ├── api/                      # Backend API
│   │   ├── server.mjs            # Main server (Hybrid RAG + Multi-hop)
│   │   └── package.json
│   └── web/                      # Frontend Next.js
│       └── src/app/page.tsx      # Main chat UI
├── docs/
│   ├── jawaban_dosen/            # 📚 Dokumentasi untuk dosen
│   │   ├── 00_ALUR_PROGRAM_LENGKAP.md
│   │   ├── 02_RAG/               # Dokumentasi RAG
│   │   ├── 03_LLM/               # Dokumentasi LLM
│   │   ├── 04_MULTI_HOP/         # Dokumentasi Multi-hop
│   │   └── ...
│   ├── todolist/                 # Checklist persiapan
│   ├── PANDUAN_INSTALASI.md      # 🚀 Panduan setup lengkap
│   └── ...
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop
- Ollama
- Node.js v20+
- pnpm

### 1. Clone Repository
```bash
git clone https://github.com/XerNero/CHAT-BOT.git
cd CHAT-BOT
```

### 2. Jalankan Qdrant (Docker)
```bash
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant
```

### 3. Setup Ollama
```bash
ollama pull llama3
```

### 4. Install Dependencies
```bash
cd apps/api && pnpm install
cd ../web && pnpm install
```

### 5. Jalankan Server
```bash
# Terminal 1: API
cd apps/api
node server.mjs

# Terminal 2: Frontend
cd apps/web
pnpm dev
```

### 6. Buka Browser
```
http://localhost:3000
```

> 📖 Untuk panduan lengkap, lihat [docs/PANDUAN_INSTALASI.md](docs/PANDUAN_INSTALASI.md)

---

## 🔀 Alur Kerja Sistem

### Single-hop RAG
```
Question → Embed → Hybrid Search → Top-8 Chunks → LLM → Answer
```

### Multi-hop RAG
```
Question → LLM Decompose → 4 Sub-queries → 4x Parallel Hybrid Search 
        → Merge + Deduplicate → LLM Synthesize → Answer
```

---

## 🛡️ Mekanisme Anti-Halusinasi

1. **Strict System Prompt** - LLM hanya boleh jawab dari context
2. **Citation Enforcement** - Wajib sitasi [#N] di setiap klaim
3. **Retry Mechanism** - Jika tidak ada sitasi, LLM diminta ulang
4. **Fallback SafeGuard** - Paksa tambah sitasi jika masih tidak ada
5. **Not Found Response** - "Tidak ditemukan di dokumen" jika tidak relevan

---

## 📊 Status Pengembangan

| Komponen | Status | Keterangan |
|----------|--------|------------|
| Backend API | ✅ 100% | server.mjs lengkap |
| Hybrid RAG | ✅ 100% | Vector + BM25 + RRF |
| Multi-hop RAG | ✅ 100% | Query Decomposition + Parallel Retrieval |
| Anti-Halusinasi | ✅ 100% | Sitasi wajib + retry mechanism |
| Frontend UI | ✅ 100% | Chat UI + toggle Multi-hop |
| PDF Ingestion | ✅ 100% | Smart chunking + embedding |
| Dokumentasi | ✅ 100% | Lengkap dengan penjelasan teknis |

**🎉 Progress: 100% Complete**

---

## 📚 Dokumentasi

| Dokumen | Deskripsi |
|---------|-----------|
| [PANDUAN_INSTALASI.md](docs/PANDUAN_INSTALASI.md) | Setup dari nol |
| [jawaban_dosen/](docs/jawaban_dosen/) | Dokumentasi teknis untuk dosen |
| [MEKANISME_ANTI_HALUSINASI.md](docs/MEKANISME_ANTI_HALUSINASI.md) | Cara mencegah halusinasi |
| [JUSTIFIKASI_ARSITEKTUR.md](docs/JUSTIFIKASI_ARSITEKTUR.md) | Alasan pemilihan teknologi |

---

## 🔧 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/ingest` | Upload PDF |
| `POST` | `/chat` | Single-hop chat |
| `POST` | `/chat-multihop` | Multi-hop chat |
| `GET` | `/documents` | List dokumen |
| `DELETE` | `/documents/:filename` | Hapus dokumen |

---

## 👥 Kontributor

- **Developer**: XerNero
- **AI Assistant**: Antigravity (Google DeepMind)

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan akademik (Skripsi/Tugas Akhir).

---

<p align="center">
  Made with ❤️ using Hybrid RAG + Ollama
</p>
