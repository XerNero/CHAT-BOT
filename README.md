# Chatbot RAG - Dokumentasi Proyek

## 📋 Deskripsi Proyek

Chatbot berbasis website yang menjawab pertanyaan pengguna **hanya berdasarkan isi file PDF**. Sistem ini dirancang untuk keperluan internal dengan prinsip **"Tidak Boleh Salah Jawab"** — jika informasi tidak ada di dokumen, chatbot akan menolak menjawab.

### Karakteristik Utama
- 🌐 **Berbasis Website** - Antarmuka chat internal
- 📄 **Sumber Jawaban: PDF Only** - Tidak boleh menjawab di luar isi dokumen
- 🇮🇩 **Bahasa Indonesia** - Seluruh interaksi dalam Bahasa Indonesia
- 🔒 **Internal System** - Untuk penggunaan internal organisasi
- 🧠 **AI Lokal (Offline)** - Tidak bergantung pada layanan cloud

---

## 🛠 Stack Teknologi

### Frontend
| Teknologi | Fungsi |
|-----------|--------|
| **Next.js (React)** | Framework web untuk UI chat internal |
| **Tailwind CSS** | Styling UI yang cepat dan responsif |

### Backend
| Teknologi | Fungsi |
|-----------|--------|
| **Node.js** | Runtime JavaScript untuk server |
| **Fastify** | Framework web API (lebih cepat dari Express) |
| **undici** | HTTP client untuk komunikasi dengan Ollama |
| **pdf-parse** | Parsing dan ekstraksi teks dari PDF |
| **@fastify/multipart** | Handling upload file PDF |

### AI & RAG
| Teknologi | Fungsi |
|-----------|--------|
| **Ollama** | Runtime LLM lokal |
| **Llama 3 (7B/8B/13B)** | Model bahasa untuk generate jawaban |
| **Qdrant** | Vector database untuk penyimpanan embedding |
| **Hybrid RAG** | Metode retrieval (Vector + BM25 + RRF) |

### Infrastruktur
| Teknologi | Fungsi |
|-----------|--------|
| **Docker** | Containerization untuk Qdrant dan Ollama |
| **Docker Compose** | Orchestration multi-container |

---

## 🏗 Arsitektur Sistem

```
User
 ↓
Next.js (Chat UI)
 ↓
Fastify API (Node.js)
 ↓
Hybrid RAG
├── Vector Search (Qdrant - Semantic)
├── BM25 Search (Node.js - Keyword)
└── RRF Rank Fusion
 ↓
Top-k PDF Chunks
 ↓
Prompt Ketat + Guardrail
 ↓
Ollama (Llama 3)
 ↓
Jawaban + Sumber Dokumen
```

---

## 📁 Struktur Folder

```
chatbot-rag/
├── apps/
│   ├── api/                 # Backend Fastify
│   │   ├── server.mjs       # Main server file
│   │   ├── package.json     # Dependencies
│   │   └── test-chat.mjs    # Test script
│   └── web/                 # Frontend Next.js (WIP)
├── data/
│   └── pdf/                 # Folder untuk file PDF sumber
├── docs/                    # Dokumentasi tambahan
├── tema_projek_chat_bot.md  # Spesifikasi proyek
├── HISTORY CHAT.txt         # Riwayat diskusi perancangan
└── README.md                # Dokumentasi utama
```

---

## 🎯 Fitur Utama

### 1. PDF Ingestion (`POST /ingest`)
- Upload file PDF via multipart form
- Extract teks dari PDF
- Chunking teks (1200 karakter, overlap 200)
- Generate embedding via Ollama
- Simpan ke Qdrant vector database

### 2. Chat dengan RAG (`POST /chat`)
- Terima pertanyaan user
- Hybrid Search: Vector + BM25 + RRF Fusion
- Generate jawaban dengan format 4 bagian
- Strict guardrail: hanya jawab dari PDF

### 3. Format Jawaban (Multi-hop 4 Bagian)
```json
{
  "answer": {
    "overview": "Ringkasan umum...",
    "detail": "Penjelasan detail...",
    "aturan": "Syarat/batasan/pengecualian...",
    "penutup": "Kesimpulan/tindak lanjut..."
  },
  "sources": [
    { "ref": "#1", "source_file": "dokumen.pdf", "chunk_index": 5 }
  ]
}
```

### 4. Guardrail Anti-Halusinasi
- ❌ Tidak menjawab jika tidak ada data relevan
- ❌ Tidak boleh inferensi/kesimpulan sendiri
- ✅ Wajib sitasi sumber [#1], [#2], dst
- ✅ Jika tidak ada bukti → "Tidak ditemukan di dokumen."

---

## 📊 Status Pengembangan

| Komponen | Status | Catatan |
|----------|--------|---------|
| Backend API | ✅ 100% | server.mjs lengkap |
| Hybrid RAG | ✅ 100% | Vector + BM25 + RRF |
| PDF Ingestion | ✅ 100% | /ingest endpoint |
| Chat Endpoint | ✅ 100% | /chat dengan 4 bagian |
| **Multi-hop RAG** | ✅ 100% | /chat-multihop dengan Query Decomposition |
| Guardrails | ✅ 100% | Sitasi, meta-block, inferensi-block |
| Frontend UI | ✅ 100% | Next.js dengan toggle Multi-hop |

**Progress Keseluruhan: ~95%**

## 👥 Kontributor

- **Mahasiswa**: [Nama Mahasiswa]
- **Dosen Pembimbing**: [Nama Dosen]
- **AI Assistant**: Antigravity (Google DeepMind)

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan akademik (Skripsi/Tugas Akhir).
