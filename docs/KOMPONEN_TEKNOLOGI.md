# Komponen Teknologi Chatbot RAG
## Dokumentasi untuk Presentasi Skripsi

---

## 1. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ARSITEKTUR CHATBOT RAG                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐  │
│   │ Frontend │ ──► │ Backend  │ ──► │ Qdrant   │ ──► │ Ollama   │  │
│   │ Next.js  │     │ Fastify  │     │ VectorDB │     │ LLM      │  │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Teknologi

### 2.1 Frontend

| Komponen | Teknologi | Versi | Fungsi |
|----------|-----------|-------|--------|
| **Framework** | Next.js | 16.x | React framework untuk web app |
| **Bahasa** | TypeScript | 5.x | Type-safe JavaScript |
| **Styling** | CSS Variables | - | Dark theme modern |

### 2.2 Backend

| Komponen | Teknologi | Versi | Fungsi |
|----------|-----------|-------|--------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Framework** | Fastify | 5.x | High-performance HTTP server |
| **PDF Parser** | pdf-parse | 1.x | Ekstraksi teks dari PDF |

### 2.3 AI & Machine Learning

| Komponen | Teknologi | Model | Fungsi |
|----------|-----------|-------|--------|
| **LLM** | Ollama | llama3:8b | Generasi jawaban |
| **Embedding** | Ollama | llama3:8b | Konversi teks ke vektor |
| **Dimensi Vektor** | - | 4096 | Ukuran vektor embedding |

### 2.4 Database

| Komponen | Teknologi | Versi | Fungsi |
|----------|-----------|-------|--------|
| **Vector DB** | Qdrant | Latest | Penyimpanan embedding |
| **Search** | BM25 | - | Keyword search |
| **Fusion** | RRF | - | Rank fusion |

---

## 3. Metode RAG (Retrieval-Augmented Generation)

### 3.1 Jenis RAG yang Digunakan

| Metode | Status | Keterangan |
|--------|--------|------------|
| **Hybrid RAG** | ✅ Aktif | Kombinasi Vector + BM25 |
| **Multi-hop RAG** | ✅ Aktif | Query decomposition |
| Graph RAG | ❌ Tidak | Terlalu kompleks untuk use case ini |

### 3.2 Hybrid Retrieval

```
Pertanyaan User
      │
      ├──► Vector Search (Semantic)
      │          │
      │          ▼
      │    Hasil berdasarkan makna
      │
      └──► BM25 Search (Lexical)
                 │
                 ▼
           Hasil berdasarkan kata kunci
                 │
                 ▼
        ┌────────────────┐
        │ Rank Fusion    │
        │ (RRF)          │
        └────────────────┘
                 │
                 ▼
        Top-K Chunks Terbaik
```

### 3.3 Multi-hop Query Decomposition

| Sub-query | Tujuan |
|-----------|--------|
| **Overview** | Gambaran umum / definisi |
| **Detail** | Langkah-langkah / poin utama |
| **Aturan** | Syarat / batasan / sanksi |
| **Penutup** | Kesimpulan / saran |

---

## 4. Model AI Detail

### 4.1 LLM (Large Language Model)

| Aspek | Spesifikasi |
|-------|-------------|
| **Provider** | Ollama (Local) |
| **Model** | llama3.2:3b |
| **Parameter** | 3 Billion |
| **Tipe** | Open-source |
| **Deployment** | On-premise / Lokal |
| **Temperature** | 0.2 (Konsisten) |

### 4.2 Embedding Model

| Aspek | Spesifikasi |
|-------|-------------|
| **Provider** | Ollama (Local) |
| **Model** | nomic-embed-text |
| **Dimensi Output** | 768 |
| **Tipe** | Open-source |
| **Bahasa** | Multilingual (termasuk Indonesia) |

---

## 5. Proses Ingestion PDF

### 5.1 Pipeline

```
PDF Upload
    │
    ▼
┌─────────────────┐
│ Ekstraksi Teks  │ ◄── pdf-parse
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Smart Chunking  │ ◄── ~800 karakter per chunk
│ (Paragraph/     │     dengan overlap 150
│  Sentence-aware)│     menghormati heading (BAB, Pasal)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Embedding       │ ◄── llama3:8b
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Simpan ke       │ ◄── Qdrant
│ Vector Database │
└─────────────────┘
```

### 5.2 Metadata yang Disimpan

| Field | Deskripsi |
|-------|-----------|
| `source_file` | Nama file PDF |
| `chunk_index` | Nomor urut chunk |
| `text` | Isi teks chunk |
| `vector` | Embedding 768 dimensi |

---

## 6. Mekanisme Anti-Halusinasi

### 6.1 System Prompt Ketat

```
ATURAN FORMAT JAWABAN:
- Gunakan Markdown untuk format rapi
- Gunakan heading, numbered list, bullet points
- Gunakan **bold** untuk istilah penting

ATURAN KONTEN:
- Jawaban HANYA berdasarkan CONTEXT
- WAJIB pakai sitasi [#N] di akhir setiap fakta
- Fallback: "Tidak ditemukan informasi..." jika tidak ada
```

### 6.2 Guardrail Checklist

| Aturan | Implementasi |
|--------|--------------|
| ✅ Hanya dari dokumen | LLM hanya menerima CONTEXT dari retrieval |
| ✅ Tolak pertanyaan luar | System prompt melarang pengetahuan umum |
| ✅ Sitasi wajib | Setiap klaim harus ada referensi [#N] |
| ✅ Fallback response | Jika tidak ada info: tolak dengan sopan |

---

## 7. API Endpoints

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/chat` | POST | Single-hop RAG |
| `/chat-multihop` | POST | Multi-hop RAG |
| `/ingest` | POST | Upload & proses PDF |
| `/docs` | GET | Daftar dokumen |
| `/health` | GET | Status sistem |

---

## 8. Perbandingan dengan Alternatif

### 8.1 Mengapa Hybrid RAG, Bukan Graph RAG?

| Aspek | Hybrid RAG | Graph RAG |
|-------|------------|-----------|
| **Kompleksitas** | ⭐ Sederhana | ⚠️ Kompleks |
| **Implementasi** | ⭐ Cepat | ⚠️ Lama |
| **Use Case** | SOP, Prosedur, Aturan | Relasi antar entitas |
| **Bahasa Indonesia** | ⭐ Stabil | ⚠️ Perlu tuning |
| **Cocok untuk proyek ini** | ✅ Ya | ❌ Overkill |

### 8.2 Mengapa Ollama, Bukan OpenAI API?

| Aspek | Ollama (Lokal) | OpenAI API |
|-------|----------------|------------|
| **Privasi** | ⭐ Data tidak keluar | ⚠️ Data dikirim ke cloud |
| **Biaya** | ⭐ Gratis | ⚠️ Berbayar |
| **Kontrol** | ⭐ Penuh | ⚠️ Terbatas |
| **Offline** | ⭐ Bisa | ❌ Tidak bisa |

---

## 9. Hasil Pengujian

### 9.1 Test 20 Pertanyaan

| Kategori | Jumlah | Hasil |
|----------|--------|-------|
| Topik Kampus (Info Ada) | 10 | ✅ 100% Dijawab |
| Topik Kampus (Info Tidak Ada) | 2 | ✅ 100% Ditolak |
| Topik Luar (Halusinasi Test) | 8 | ✅ 100% Ditolak |

**Total: 20/20 SUKSES (100%)**

---

## 10. Referensi Akademis

1. Lewis, P., et al. (2020). *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*
2. Robertson, S., & Zaragoza, H. (2009). *The Probabilistic Relevance Framework: BM25 and Beyond*
3. Cormack, G. V., et al. (2009). *Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods*

---

*Dokumen ini dibuat untuk keperluan presentasi skripsi*  
*Terakhir diperbarui: 12 Januari 2026*
