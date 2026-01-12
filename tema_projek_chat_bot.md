# Tema Proyek Chatbot RAG
## Chatbot Dokumen Kampus dengan Multi-hop Retrieval

---

## 1. Deskripsi Proyek

Chatbot berbasis **Retrieval-Augmented Generation (RAG)** yang dirancang untuk menjawab pertanyaan mahasiswa berdasarkan **dokumen resmi kampus** (PDF). Sistem ini menggunakan arsitektur **Multi-hop** untuk mendapatkan jawaban yang komprehensif.

### Fitur Utama
- ✅ Menjawab pertanyaan berdasarkan isi dokumen PDF
- ✅ Anti-halusinasi (tidak mengarang jawaban)
- ✅ Sitasi sumber untuk setiap fakta
- ✅ Hybrid Retrieval (BM25 + Vector Search)
- ✅ Multi-hop Query Decomposition

---

## 2. Arsitektur Sistem

### 2.1 Stack Teknologi

| Komponen | Teknologi | Fungsi |
|----------|-----------|--------|
| **Frontend** | Next.js (React) | UI Chat modern |
| **Backend** | Node.js (Fastify) | API server |
| **Vector DB** | Qdrant | Penyimpanan embedding |
| **LLM** | Ollama (Llama 3.2) | Generasi jawaban |
| **Embedding** | nomic-embed-text | Konversi teks ke vektor |

### 2.2 Alur Kerja RAG

```
┌─────────────────────────────────────────────────────────────────┐
│                        ALUR KERJA RAG                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [1] Pertanyaan      [2] Retrieval           [3] LLM           │
│   ─────────────       ───────────────         ─────────         │
│                                                                 │
│   "Apa syarat    ──►  Cari di Qdrant    ──►   Sintesis          │
│    yudisium?"         (BM25 + Vector)         Jawaban           │
│                              │                     │            │
│                              ▼                     ▼            │
│                        [CONTEXT]              [JAWABAN]         │
│                        Chunk relevan          + Sitasi [#N]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Multi-hop Query Decomposition

### 3.1 Konsep

Satu pertanyaan user dipecah menjadi 4 sub-pertanyaan untuk mendapatkan context yang lebih komprehensif:

| Sub-query | Tujuan |
|-----------|--------|
| **Overview** | Gambaran umum/definisi |
| **Detail** | Langkah-langkah/poin utama |
| **Aturan** | Syarat/batasan/pengecualian |
| **Penutup** | Kesimpulan/tindak lanjut |

### 3.2 Alur Multi-hop

```
Pertanyaan User
      │
      ▼
┌─────────────────┐
│ Query           │
│ Decomposition   │
└─────────────────┘
      │
      ├──► Sub-query Overview  ──► Retrieval ──► Chunk 1,2,3
      ├──► Sub-query Detail    ──► Retrieval ──► Chunk 4,5
      ├──► Sub-query Aturan    ──► Retrieval ──► Chunk 6,7
      └──► Sub-query Penutup   ──► Retrieval ──► Chunk 8,9
                                        │
                                        ▼
                              ┌─────────────────┐
                              │ Merge + Dedup   │
                              └─────────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │ LLM Synthesis   │
                              │ (Satu Narasi)   │
                              └─────────────────┘
                                        │
                                        ▼
                              [JAWABAN FINAL + SITASI]
```

---

## 4. Hybrid Retrieval

### 4.1 Dual Search Strategy

| Metode | Deskripsi | Kelebihan |
|--------|-----------|-----------|
| **BM25 (Lexical)** | Pencarian kata kunci | Akurat untuk istilah teknis |
| **Vector Search** | Pencarian semantik | Memahami sinonim & konteks |

### 4.2 Rank Fusion (RRF)

Hasil kedua metode digabungkan dengan formula:
```
RRF_score = Σ (1 / (k + rank_i))
```

---

## 5. Mekanisme Anti-Halusinasi

### 5.1 System Prompt Ketat

```
ATURAN MUTLAK (STRICT):
1. SCOPE KAMPUS SAJA: Hanya jawab dari dokumen kampus UTN
2. TOLAK TOKOH UMUM: Jangan gunakan pengetahuan luar
3. JAWABAN TUNGGAL: Buat satu narasi padu
4. SITASI WAJIB: Setiap fakta harus ada [#N]

Jika tidak ada di CONTEXT: "Tidak ditemukan informasi yang relevan."
```

### 5.2 Guardrail Checklist

| Aturan | Implementasi |
|--------|--------------|
| ✅ Hanya dari dokumen | LLM hanya menerima CONTEXT dari retrieval |
| ✅ Tolak pertanyaan luar | System prompt melarang pengetahuan umum |
| ✅ Sitasi wajib | Setiap klaim harus ada referensi [#N] |
| ✅ Fallback response | Jika tidak ada info: tolak dengan sopan |

---

## 6. API Endpoints

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/chat` | POST | Single-hop RAG |
| `/chat-multihop` | POST | Multi-hop RAG |
| `/ingest` | POST | Upload & proses PDF |
| `/docs` | GET | Daftar dokumen |
| `/health` | GET | Status sistem |

### Response Format

```json
{
  "answer": "Jawaban dalam satu narasi dengan sitasi [#1]...",
  "sources": [
    {
      "ref": "[#1]",
      "source_file": "Buku_Pedoman.pdf",
      "chunk_index": 42,
      "fused_score": 0.85
    }
  ]
}
```

---

## 7. Struktur Proyek

```
chatbot-rag/
├── apps/
│   ├── api/              # Backend (Fastify)
│   │   ├── server.mjs    # Main server
│   │   └── ingestion/    # PDF processing
│   └── web/              # Frontend (Next.js)
│       └── src/app/      # React components
├── docs/                 # Dokumentasi
├── start.bat             # Script untuk menjalankan
└── README.md
```

---

## 8. Cara Menjalankan

### Prasyarat
1. Docker Desktop (untuk Qdrant)
2. Ollama (untuk LLM)
3. Node.js v18+

### Langkah
```bash
# 1. Jalankan Qdrant
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant

# 2. Jalankan Ollama
ollama serve

# 3. Jalankan aplikasi
start.bat  # Windows
./start.sh # Linux/Mac
```

### Akses
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

---

## 9. Hasil Pengujian

### Test 20 Pertanyaan Random

| Kategori | Jumlah | Hasil |
|----------|--------|-------|
| Topik Kampus (Info Ada) | 10 | ✅ 100% Dijawab |
| Topik Kampus (Info Tidak Ada) | 2 | ✅ 100% Ditolak |
| Topik Luar (Halusinasi Test) | 8 | ✅ 100% Ditolak |

**Total: 20/20 SUKSES (100%)**

---

## 10. Status Implementasi

| Fitur | Status |
|-------|--------|
| Frontend Next.js | ✅ Selesai |
| Backend Fastify | ✅ Selesai |
| Hybrid Retrieval | ✅ Selesai |
| Multi-hop RAG | ✅ Selesai |
| Anti-Halusinasi | ✅ Selesai |
| Sitasi Sumber | ✅ Selesai |
| Format Jawaban Tunggal | ✅ Selesai |

**🚀 PROYEK SIAP PRODUKSI**

---

*Dokumen ini terakhir diperbarui: 3 Januari 2026*