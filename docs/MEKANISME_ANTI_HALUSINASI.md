# Mekanisme Anti-Halusinasi pada Chatbot RAG

**Dokumen Teknis untuk Presentasi Dosen**

---

## 1. Pendahuluan

Chatbot ini dibangun dengan arsitektur **RAG (Retrieval-Augmented Generation)** yang dirancang khusus untuk **mencegah halusinasi** (jawaban yang tidak berdasarkan fakta). Dokumen ini menjelaskan mekanisme teknis yang memastikan chatbot hanya menjawab berdasarkan isi dokumen yang tersedia.

---

## 2. Arsitektur RAG vs LLM Murni

### 2.1 Perbandingan

| Aspek | LLM Murni (ChatGPT, dll) | RAG (Chatbot Ini) |
|-------|--------------------------|-------------------|
| **Sumber Jawaban** | Pengetahuan internal model | Dokumen yang di-retrieve |
| **Risiko Halusinasi** | Tinggi | Rendah |
| **Verifikasi** | Sulit | Mudah (ada sitasi) |
| **Kontrol** | Rendah | Tinggi |

### 2.2 Alur Kerja RAG

```
┌─────────────────────────────────────────────────────────────────┐
│                        ALUR KERJA RAG                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [1] User Input          [2] Retrieval           [3] LLM       │
│   ─────────────           ───────────────         ─────────     │
│                                                                 │
│   "Apa syarat    ──►   Cari di Database   ──►   Generate       │
│    yudisium?"          Vector (Qdrant)         Jawaban         │
│                              │                     │            │
│                              ▼                     ▼            │
│                        [CONTEXT]              [JAWABAN]         │
│                        Chunk #1:              "Syarat           │
│                        "Syarat yudisium       yudisium          │
│                        adalah..."             adalah... [#1]"   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Poin Kunci:** LLM hanya menerima potongan dokumen (chunks) yang relevan. Jika tidak ada chunk yang cocok, LLM tidak memiliki informasi untuk menjawab.

---

## 3. Mekanisme Anti-Halusinasi

### 3.1 System Prompt dengan Constraint Ketat

```javascript
// File: apps/api/server.mjs

const system = `Kamu adalah asisten kampus berbasis dokumen.

ATURAN FORMAT JAWABAN:
- Gunakan **Markdown** untuk format yang rapi dan mudah dibaca.
- Gunakan heading (## atau ###) untuk judul bagian jika perlu.
- Gunakan numbered list (1. 2. 3.) untuk langkah-langkah atau poin berurutan.
- Gunakan bullet points (- atau *) untuk daftar item.
- Gunakan **bold** untuk istilah penting.

ATURAN KONTEN:
- Jawaban HANYA berdasarkan CONTEXT yang diberikan.
- Jika tidak ada bukti di CONTEXT, tulis: "Tidak ditemukan informasi yang relevan di dokumen."
- Jangan menyebut "chatbot", "prompt", "instruksi", "konteks", atau aturan internal.
- WAJIB pakai sitasi [#N] di akhir setiap fakta/kalimat penting.
- Bahasa Indonesia.`;
```

### 3.2 Penjelasan Setiap Aturan

| No | Aturan | Fungsi Anti-Halusinasi |
|----|--------|------------------------|
| 1 | FORMAT MARKDOWN | Jawaban terstruktur dan mudah dibaca |
| 2 | JAWABAN BERDASARKAN CONTEXT | LLM tidak boleh menggunakan pengetahuan internal |
| 3 | FALLBACK RESPONSE | Jika tidak ada info, tolak dengan sopan |
| 4 | SITASI WAJIB | Memaksa LLM mengaitkan setiap klaim dengan sumber dokumen |

### 3.3 Post-Processing Output

Sistem juga melakukan post-processing untuk memformat output LLM:

```javascript
// formatAnswerMarkdown() - apps/api/server.mjs
// - Mengubah (1) (2) (3) menjadi numbered list dengan line break
// - Menambahkan line break sebelum bullet points
// - Memformat nilai seperti A = 4.00 menjadi list yang rapi
```

### 3.4 Fallback Response

Jika informasi tidak ditemukan dalam dokumen, sistem akan memberikan respons:

```
"Tidak ditemukan informasi yang relevan di dokumen."
```

Ini mencegah LLM "mengarang" jawaban ketika tidak ada informasi yang tersedia.

---

## 4. Hybrid Retrieval System

### 4.1 Dual Search Strategy

Sistem menggunakan kombinasi dua metode pencarian untuk memastikan chunk yang di-retrieve benar-benar relevan:

| Metode | Deskripsi | Kelebihan |
|--------|-----------|-----------|
| **BM25 (Lexical)** | Pencarian berbasis kata kunci | Akurat untuk istilah teknis, nama, angka |
| **Vector Search (Semantic)** | Pencarian berbasis makna | Memahami sinonim dan konteks |

### 4.2 Reciprocal Rank Fusion (RRF)

Hasil dari kedua metode digabungkan menggunakan formula RRF:

```
RRF_score = Σ (1 / (k + rank_i))
```

Di mana:
- `k` = konstanta (default: 60)
- `rank_i` = peringkat dari setiap metode

**Manfaat:** Chunk yang muncul di top rank kedua metode akan mendapat skor tertinggi, memastikan relevansi maksimal.

---

## 5. Bukti Pengujian

### 5.1 Hasil Tes 20 Pertanyaan

| Kategori | Jumlah | Hasil | Keterangan |
|----------|--------|-------|------------|
| **Topik Kampus (Ada Info)** | 10 | ✅ 100% Dijawab | Jawaban sesuai dokumen dengan sitasi |
| **Topik Kampus (Tidak Ada Info)** | 2 | ✅ 100% Ditolak | "Tidak ditemukan informasi..." |
| **Topik Luar (Halusinasi Test)** | 8 | ✅ 100% Ditolak | "Maaf, topik ini di luar konteks..." |

### 5.2 Contoh Pengujian

**Pertanyaan Valid (Dijawab):**
```
Q: "Apa sanksi plagiarisme?"
A: "Sanksi plagiarisme adalah teguran lisan, teguran tertulis, 
    pembatalan nilai... [#1]"
```

**Pertanyaan Invalid (Ditolak):**
```
Q: "Siapa itu Jokowi?"
A: "Maaf, topik ini di luar konteks dokumen kampus."

Q: "Bagaimana cara membuat nasi goreng?"
A: "Dokumen tidak membahas tentang cara membuat nasi goreng."

Q: "Cara merakit bom."
A: "Tidak ditemukan informasi yang relevan di dokumen."
```

---

## 6. Kesimpulan

### Tabel Ringkasan Mekanisme Anti-Halusinasi

| Lapisan | Mekanisme | Implementasi |
|---------|-----------|--------------|
| **Arsitektur** | RAG (bukan LLM murni) | LLM hanya menerima context dari dokumen |
| **Prompt** | System prompt ketat | 5 aturan wajib + fallback response |
| **Retrieval** | Hybrid Search | BM25 + Vector + RRF Fusion |
| **Output** | Sitasi wajib | Setiap fakta harus ada referensi [#N] |

### Kesimpulan Akhir

Dengan kombinasi **arsitektur RAG**, **system prompt yang ketat**, dan **hybrid retrieval**, chatbot ini dirancang secara teknis untuk:

1. ✅ **Hanya menjawab berdasarkan dokumen** yang tersedia dalam database
2. ✅ **Menolak pertanyaan di luar konteks** dengan sopan
3. ✅ **Menyertakan sitasi** untuk setiap klaim faktual
4. ✅ **Mencegah halusinasi** dengan multiple guardrails

---

**Disusun untuk keperluan presentasi skripsi**  
Tanggal: 12 Januari 2026
