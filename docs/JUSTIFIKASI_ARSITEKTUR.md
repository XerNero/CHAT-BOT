# Justifikasi Arsitektur & Perbandingan Teknis
## Dokumen untuk Bimbingan Skripsi/Tugas Akhir

---

## 📌 Ringkasan Keputusan Arsitektur

| Komponen       | Pilihan               | Alternatif yang Dipertimbangkan      |
|----------      |---------------------- |------------------------------------  | 
| **Metode RAG** | Hybrid RAG            | Vector RAG, Graph RAG, Agentic RAG   |
| **Pendekatan** | Zero-shot + Multi-hop | Fine-tuning, Single-hop              |
| **LLM**        | Ollama (Llama 3 8B)   | OpenAI API, Claude, Fine-tuned model |
| **Vector DB**  | Qdrant                | Chroma, Pinecone, pgvector           |
| **Backend**    | Fastify (Node.js)     | Express, FastAPI (Python)            |
| **Frontend**   | Next.js (React)       | Vue, Svelte, HTML+JS                 |

---

## 1️⃣ Perbandingan Metode RAG

### A. Vector RAG vs Hybrid RAG vs Graph RAG

| Aspek          | Vector RAG | Hybrid RAG  ✅ | Graph RAG |
|----------------|------------|---------------|-----------|
| **Kompleksitas** | Rendah | Sedang | Tinggi |
| **Akurasi**    | 70-85% | 85-95% | 90-97% |
| **Waktu Implementasi** | 1-2 minggu | 2-3 minggu | 1-2 bulan |
| **Cocok untuk Bahasa Indonesia** | Cukup | Sangat Baik | Baik |
| **Handling Istilah Teknis** | Lemah | Kuat | Kuat |
| **Maintenance** | Mudah | Mudah | Sulit |
| **Kebutuhan Data** | Embedding saja | Embedding + Index | Graph + Entity Extraction |

### Mengapa Memilih Hybrid RAG?

**1. Keseimbangan Akurasi dan Kompleksitas**
> "Hybrid RAG adalah sweet spot terbaik untuk 80-90% chatbot PDF internal."

- Vector RAG saja sering **miss keyword penting** seperti istilah teknis, nomor pasal, nama jabatan
- BM25 saja **tidak paham konteks** semantik
- **Hybrid RAG** mengambil kelebihan keduanya

**2. Lebih Stabil untuk Bahasa Indonesia**
- Embedding model (terutama yang tidak khusus Bahasa Indonesia) kadang kurang sensitif terhadap istilah formal
- BM25 sangat kuat untuk **exact match** bahasa Indonesia
- Gabungan keduanya menghasilkan retrieval yang lebih robust

**3. Lebih Aman untuk "Jawaban Wajib dari PDF"**
- Hybrid memungkinkan **threshold ganda** (semantic + keyword)
- Filtering ketat sebelum LLM dipanggil
- Jika kedua metode menghasilkan skor rendah → **tolak jawab**
- Ini adalah kunci anti-halusinasi

**4. Graph RAG Ditunda, Bukan Ditolak**
> "Graph RAG adalah senjata khusus, bukan senjata utama."

Graph RAG lebih cocok jika:
- Pertanyaan sering butuh "menghubungkan titik" (multi-hop relasi)
- Dokumen saling merujuk antar bagian
- Ada struktur organisasi + siapa bertanggung jawab apa

Untuk tahap awal, **Hybrid RAG sudah mencukupi**. Graph RAG dapat ditambahkan sebagai upgrade di masa depan jika ditemukan kasus yang sering gagal karena "butuh relasi".

---

## 2️⃣ Perbandingan Pendekatan: Zero-shot vs Fine-tuning

| Aspek | Zero-shot + RAG ✅ | Fine-tuning |
|-------|-------------------|-------------|
| **Akurasi Fakta** | Tinggi (grounded) | Berisiko (overgeneralization) |
| **Kemudahan Update** | Mudah (update PDF saja) | Sulit (perlu retrain) |
| **Risiko Halusinasi** | Rendah | Tinggi |
| **Biaya Komputasi** | Rendah | Tinggi |
| **Waktu Implementasi** | Cepat | Lama |

### Mengapa Memilih Zero-shot?

**Analogi Sederhana:**
- **Fine-tuning** = Ujian hafalan
- **Zero-shot + RAG** = Ujian buka buku

> "Kalau bukunya (PDF) benar dan diambil dengan tepat, jawaban pasti benar."

**1. Akurasi TIDAK Ditentukan oleh Zero-shot**
```
Akurasi Chatbot ≈ Kualitas Retrieval + Guardrail
BUKAN:
Akurasi ≈ Fine-tuning / Training ulang
```

**2. Urutan Pengaruh terhadap Akurasi:**
1. 🥇 **Retrieval** (PALING KRUSIAL) - Chunking, Hybrid RAG, Threshold, Re-ranking
2. 🥈 **Prompt & Guardrail** - Aturan "jangan jawab di luar konteks"
3. 🥉 **Model LLM** - 7B vs 13B (berpengaruh tapi bukan faktor utama)

**3. Zero-shot TIDAK Mengurangi Akurasi**
> "Zero-shot justru mengurangi risiko halusinasi karena model tidak mengandalkan pengetahuan internal, melainkan hanya menjawab berdasarkan konteks dokumen yang diberikan."

---

## 3️⃣ Perbandingan Format Output: Single-hop vs Multi-hop (4 Bagian)

| Aspek | Single-hop | Multi-hop (4 Bagian) ✅ |
|-------|------------|------------------------|
| **Kelengkapan Jawaban** | Parsial | Komprehensif |
| **Struktur** | Tidak terstruktur | Terstruktur (Overview, Detail, Aturan, Penutup) |
| **Transparansi** | Kurang | Tinggi (tiap bagian ada sumber) |
| **Kemudahan Verifikasi** | Sulit | Mudah |

### Mengapa Format 4 Bagian?

**1. Lebih Lengkap untuk Dokumen Internal**
Dokumen internal biasanya memiliki:
- Definisi/overview
- Prosedur/langkah detail
- Syarat/batasan/pengecualian
- Kesimpulan/tindak lanjut

Format 4 bagian memastikan semua aspek tercakup.

**2. Anti-Halusinasi per Bagian**
Jika salah satu bagian tidak ditemukan → ditulis eksplisit:
> "Tidak ditemukan di dokumen."

Ini lebih baik daripada model "mengarang" penutup yang tidak ada di PDF.

**3. Coverage Check**
Sistem memastikan ada minimal 1 chunk untuk:
- Definisi/overview
- Prosedur/detail
- Catatan/pengecualian/closure

Jika tidak ketemu → bot bilang eksplisit tidak tersedia.

### Implementasi Multi-hop Query Decomposition

Sistem Multi-hop yang diimplementasikan melakukan **4 langkah** untuk setiap pertanyaan:

```
┌─────────────────┐
│  User Question  │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────┐
│  1. DECOMPOSE (LLM)                 │
│  1 pertanyaan → 4 sub-pertanyaan    │
│  - Overview: definisi/konteks       │
│  - Detail: langkah/poin utama       │
│  - Aturan: syarat/batasan           │
│  - Penutup: kesimpulan/tindak lanjut│
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│  2. RETRIEVE (4x Parallel)          │
│  Hybrid RAG untuk setiap sub-query  │
│  → 4 set of chunks dengan hop label │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│  3. MERGE & DEDUP                   │
│  Gabung semua chunks                │
│  Hapus duplikat                     │
│  Pertahankan label hop              │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│  4. SYNTHESIZE (LLM)                │
│  Generate jawaban 4 bagian          │
│  dengan sitasi [#1], [#2]           │
│  berdasarkan evidence per hop       │
└─────────────────────────────────────┘
```

**Keuntungan Multi-hop:**
- Retrieval lebih **targeted** (sub-query spesifik per bagian)
- Jawaban lebih **lengkap** (tidak miss bagian tertentu)
- **Transparansi** tinggi (setiap source ada label hop-nya)
- **Coverage check** per bagian (jika hop tidak ada evidence → eksplisit "tidak ditemukan")

---

## 4️⃣ Perbandingan LLM: Cloud vs Lokal (Ollama)

| Aspek | Cloud (OpenAI, dll) | Lokal (Ollama) ✅ |
|-------|--------------------|--------------------|
| **Privasi Data** | Berisiko | 100% Aman |
| **Biaya** | Tinggi (per token) | Gratis |
| **Ketersediaan** | Butuh Internet | Offline |
| **Kecepatan** | Tergantung jaringan | Konsisten |
| **Kontrol** | Terbatas | Penuh |
| **Compliance Internal** | Sulit | Mudah |

### Mengapa Memilih Ollama dengan Llama 3?

**1. Rekomendasi Dosen**
> "Dosen merekomendasikan Ollama dengan model Llama parameter 3-7 atau 13."

**2. 100% Offline dan Internal**
- Tidak ada data yang keluar ke internet
- Cocok untuk dokumen internal/sensitif
- Tidak bergantung pada ketersediaan layanan cloud

**3. Mudah Dikontrol**
- Model tidak "bocor" ke luar dokumen
- Cocok untuk RAG ketat

**4. Perbandingan Parameter:**
- **7B/8B**: Lebih ringan, cepat, cocok jika pertanyaan sederhana dan konteks jelas
- **13B**: Kualitas reasoning & kepatuhan konteks lebih baik, tapi lebih berat

> "Untuk 'jawab hanya dari PDF', kualitas terbaik biasanya datang dari retrieval bagus + threshold ketat + prompt disiplin, **bukan dari ukuran model saja**."

---

## 5️⃣ Perbandingan Vector Database

| Aspek | Qdrant ✅ | Chroma | Pinecone | pgvector |
|-------|----------|--------|----------|----------|
| **Open Source** | ✅ | ✅ | ❌ | ✅ |
| **Deployment** | Docker/Cloud | Docker | Cloud | Postgres |
| **Performa** | Sangat Cepat | Cukup | Cepat | Cukup |
| **Metadata Filtering** | Sangat Kuat | Cukup | Kuat | Dasar |
| **Hybrid Search** | Built-in | Manual | Manual | Manual |
| **Learning Curve** | Sedang | Mudah | Mudah | Mudah |

### Mengapa Memilih Qdrant?

**1. Open-source dan Stabil**
- Tidak ada biaya lisensi
- Komunitas aktif

**2. Metadata Filtering Kuat**
- Bisa filter berdasarkan: `doc_id`, `page`, `section`, `chunk_id`
- Penting untuk menampilkan sumber yang akurat

**3. Cocok untuk Skala "PDF Banyak"**
- Handle ribuan hingga jutaan chunks
- Performa tetap konsisten

**4. Gampang Dipakai dari Node.js**
- Client library resmi: `@qdrant/js-client-rest`
- API yang intuitif

---

## 6️⃣ Perbandingan Backend Framework

| Aspek | Fastify ✅ | Express | FastAPI (Python) |
|-------|-----------|---------|------------------|
| **Performa** | Sangat Cepat | Cukup | Cepat |
| **Ecosystem AI/RAG** | LangChain.js | LangChain.js | LangChain (Python) |
| **Learning Curve** | Sedang | Mudah | Mudah |
| **Plugin Multipart** | Native | Manual | Native |
| **TypeScript Support** | Excellent | Good | N/A |

### Mengapa Memilih Fastify?

**1. Performa Lebih Baik dari Express**
- 2-3x lebih cepat dalam benchmark
- Lebih cocok untuk API internal

**2. Plugin System yang Rapi**
- `@fastify/multipart` untuk upload PDF
- Schema validation built-in

**3. Konsisten dengan Next.js**
- Keduanya JavaScript/TypeScript
- Tim bisa fokus di satu bahasa

---

## 7️⃣ Guardrail: Aturan "Tidak Boleh Salah Jawab"

### Checklist Keamanan Sistem

| # | Aturan | Status |
|---|--------|--------|
| 1 | Jawaban selalu 4 bagian | ✅ |
| 2 | Tiap bagian hanya dari evidence (chunks) | ✅ |
| 3 | Jika evidence kosong → "Tidak tersedia dalam dokumen." | ✅ |
| 4 | Jika total evidence minim → tolak jawab semua | ✅ |
| 5 | Selalu tampilkan sumber (doc, page, chunk_id) | ✅ |
| 6 | Tidak ada jawaban berbasis "pengetahuan umum" | ✅ |
| 7 | Sitasi wajib [#1], [#2] di setiap klaim | ✅ |
| 8 | Blok inferensi ("dapat disimpulkan") | ✅ |
| 9 | Blok meta/policy ("kami sarankan") | ✅ |

---

## 8️⃣ Kesimpulan Justifikasi

### Ringkasan Keputusan Final

1. **Hybrid RAG** dipilih karena memberikan keseimbangan terbaik antara akurasi (85-95%) dan kompleksitas implementasi. Vector RAG terlalu lemah untuk istilah teknis, Graph RAG terlalu kompleks untuk tahap awal.

2. **Zero-shot + Multi-hop** dipilih karena lebih aman dari halusinasi dibanding fine-tuning, dan format 4 bagian memastikan jawaban komprehensif.

3. **Ollama (Llama 3)** dipilih karena 100% offline, gratis, dan sesuai rekomendasi dosen. Kontrol penuh terhadap model.

4. **Qdrant** dipilih karena open-source, performa tinggi, metadata filtering kuat, dan cocok untuk Hybrid RAG.

5. **Fastify + Next.js** dipilih untuk konsistensi stack (JavaScript), performa tinggi, dan kemudahan pengembangan.

### Kutipan Penting untuk Presentasi

> "Akurasi chatbot tidak ditentukan oleh ukuran model atau apakah zero-shot/fine-tuning. Akurasi ditentukan oleh **kualitas retrieval** dan **ketatnya guardrail**."

> "Hybrid RAG adalah sweet spot terbaik — mengambil kelebihan semantic search (pemahaman konteks) dan keyword search (ketepatan istilah)."

> "Zero-shot + RAG seperti ujian buka buku: kalau bukunya benar dan diambil dengan tepat, jawaban pasti benar."

> "Graph RAG adalah senjata khusus untuk kasus relasi kompleks. Untuk 80-90% use case chatbot PDF, Hybrid RAG sudah lebih dari cukup."

---

## 📚 Referensi

1. Lewis, P. et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"
2. Edge et al. (2024). "From Local to Global: A Graph RAG Approach to Query-Focused Summarization"
3. Robertson, S. & Zaragoza, H. (2009). "The Probabilistic Relevance Framework: BM25 and Beyond"
4. LangChain Documentation: https://js.langchain.com/
5. Qdrant Documentation: https://qdrant.tech/documentation/
6. Ollama Documentation: https://ollama.ai/

---

*Dokumen ini disiapkan untuk keperluan bimbingan skripsi/tugas akhir.*
