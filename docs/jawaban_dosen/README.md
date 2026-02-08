# 📚 Jawaban Dosen - Persiapan Bimbingan

## 🗂️ Struktur Folder (Alur Penjelasan)

```
jawaban_dosen/
├── 01_CARA_MEMBANGUN/     ← "Pak, ini cara saya membangun sistem..."
│   ├── 01_INGESTION_PDF.md     (upload PDF, extract text)
│   ├── 02_EMBEDDING.md         (convert teks → vektor)
│   ├── 03_LIBRARY_REQUIREMENT.md
│   └── 04_SMART_CHUNKING.md    (strategi potong dokumen)
│
├── 02_RAG/                ← "Ini komponen RAG-nya, Pak..."
│   ├── 01_HYBRID_RETRIEVAL.md  (Vector + BM25 + RRF)
│   ├── 02_KELEMAHAN_RAG.md     (dan solusinya)
│   ├── 03_KNOWLEDGE_CUTOFF.md  (cara atasi)
│   ├── 04_EMBEDDING_VECTOR.md  (hubungan embed → search)
│   └── 05_HYBRID_VS_VECTOR.md  (kenapa hybrid lebih baik)
│
├── 03_LLM/                ← "Ini komponen LLM-nya, Pak..."
│   ├── 01_CARA_GENERATE_TEKS.md (Transformer, Attention)
│   ├── 02_KENAPA_HALUSINASI.md  (5 penyebab)
│   └── 03_CONTEXT_SIZE.md       (pengaruh ke jawaban)
│
├── 04_MULTI_HOP/          ← "Ini fitur Multi-hop, Pak..."
│   ├── 01_CARA_KERJA.md        (decomposition → retrieval → synthesis)
│   └── 02_KENAPA_BUTUH_LLM.md  (LLM untuk pecah query)
│
├── 05_HUBUNGAN_KOMPONEN/  ← "Hubungan antar komponen..."
│   └── 01_LLM_DAN_RAG.md       (collaboration)
│
├── 06_TEKNIS_ALGORITMA/   ← "Jika ditanya rumus..."
│   ├── 01_FORMULA_RRF.md       (Reciprocal Rank Fusion)
│   ├── 02_COSINE_SIMILARITY.md (vektor similarity)
│   ├── 03_BM25_FORMULA.md      (keyword ranking)
│   └── 04_CONCURRENT.md        (handle banyak user)
│
└── 07_EVALUASI_IMPROVEMENT/ ← "Cara evaluasi dan improvement..."
    ├── 01_ANTI_HALUSINASI.md   (validation, retry)
    ├── 02_METRIK_RETRIEVAL.md  (Precision, Recall, MRR)
    └── 03_IMPROVEMENT.md       (roadmap ke depan)
```

---

## 🎯 Alur Penjelasan ke Dosen

### **Tahap 1: Cara Membangun (01_CARA_MEMBANGUN)**
Mulai dari:
1. **Library** - Apa saja yang dipakai
2. **Ingestion** - Cara upload dan proses PDF
3. **Chunking** - Cara potong dokumen
4. **Embedding** - Cara convert ke vektor

### **Tahap 2: Jelaskan RAG (02_RAG)**
1. **Hybrid Retrieval** - Vector + BM25 + RRF
2. **Embedding → Vector** - Hubungannya
3. **Hybrid vs Vector** - Kenapa lebih baik
4. **Kelemahan + Solusi**
5. **Knowledge Cutoff**

### **Tahap 3: Jelaskan LLM (03_LLM)**
1. **Generate Teks** - Transformer, Attention
2. **Halusinasi** - Kenapa bisa terjadi
3. **Context Size** - Pengaruh ke jawaban

### **Tahap 4: Jelaskan Multi-hop (04_MULTI_HOP)**
1. **Cara Kerja** - Decomposition, parallel retrieval, synthesis
2. **Kenapa Butuh LLM** - Untuk pecah query

### **Tahap 5: Hubungan Komponen (05_HUBUNGAN_KOMPONEN)**
1. **LLM + RAG** - Bagaimana bekerja sama

### **Tahap 6: Teknis (06_TEKNIS_ALGORITMA)**
*Jika dosen tanya rumus:*
1. RRF, Cosine, BM25
2. Concurrent handling

### **Tahap 7: Evaluasi (07_EVALUASI_IMPROVEMENT)**
1. Anti-halusinasi yang sudah diterapkan
2. Metrik retrieval
3. Improvement roadmap

---

## 📋 Quick Reference

| Folder | Topik | Jumlah File |
|--------|-------|-------------|
| 01_CARA_MEMBANGUN | Ingestion, Chunking, Embedding, Library | 4 |
| 02_RAG | Retrieval, Kelemahan, Hybrid | 5 |
| 03_LLM | Generate, Halusinasi, Context | 3 |
| 04_MULTI_HOP | Decomposition, LLM role | 2 |
| 05_HUBUNGAN_KOMPONEN | LLM ↔ RAG | 1 |
| 06_TEKNIS_ALGORITMA | RRF, Cosine, BM25, Concurrent | 4 |
| 07_EVALUASI_IMPROVEMENT | Anti-hallucination, Metrics, Roadmap | 3 |

**Total: 22 file dokumentasi**

---

## ✅ Checklist Persiapan

### Sebelum Bimbingan
- [ ] Baca folder 01-04 (core system)
- [ ] Siapkan `apps/api/server.mjs` di laptop
- [ ] Review baris kode penting (lihat di setiap file)

### Saat Bimbingan
- [ ] Jelaskan per folder, ikuti alur 1→7
- [ ] Tunjukkan kode langsung di laptop
- [ ] Gambar diagram jika diperlukan
