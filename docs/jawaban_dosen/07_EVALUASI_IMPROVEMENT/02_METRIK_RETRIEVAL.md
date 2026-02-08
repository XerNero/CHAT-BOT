# Pertanyaan 21: Bagaimana Mengukur Kualitas Retrieval?

## Pertanyaan Dosen
> "Bagaimana mengukur retrieval itu bagus atau tidak? Ada metriknya?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, kualitas retrieval bisa diukur dengan metrik:**
1. **Precision** - Dari yang di-retrieve, berapa yang relevan?
2. **Recall** - Dari yang relevan, berapa yang ter-retrieve?
3. **MRR (Mean Reciprocal Rank)** - Posisi hasil relevan pertama
4. **NDCG** - Kualitas ranking secara keseluruhan

**Saat ini saya pakai pengujian manual. Untuk formal, perlu ground truth dataset."**

---

## 📖 Penjelasan Detail

### Metrik Retrieval

#### 1. Precision@K

**"Dari K hasil yang di-retrieve, berapa persennya yang relevan?"**

```
Formula:
Precision@K = (Jumlah relevan dalam top-K) / K

Contoh:
Query: "Syarat yudisium"
Top-5 hasil retrieve:
1. "Syarat yudisium adalah..." ✅ Relevan
2. "IPK minimal 2.00..." ✅ Relevan
3. "Prosedur cuti..." ❌ Tidak relevan
4. "Nilai E yudisium..." ✅ Relevan
5. "Biaya kuliah..." ❌ Tidak relevan

Precision@5 = 3/5 = 0.60 (60%)
```

---

#### 2. Recall@K

**"Dari semua yang relevan, berapa persennya yang ter-retrieve di top-K?"**

```
Formula:
Recall@K = (Jumlah relevan dalam top-K) / (Total relevan di database)

Contoh:
Total chunk relevan untuk "syarat yudisium" = 5 chunk
Ter-retrieve di top-5 = 3 chunk

Recall@5 = 3/5 = 0.60 (60%)
```

---

#### 3. MRR (Mean Reciprocal Rank)

**"Di posisi berapa hasil relevan pertama muncul?"**

```
Formula:
RR = 1 / (posisi hasil relevan pertama)
MRR = rata-rata RR dari semua query

Contoh Query 1:
Hasil: [Relevan, Tidak, Tidak, ...]
Posisi relevan pertama = 1
RR = 1/1 = 1.0

Contoh Query 2:
Hasil: [Tidak, Tidak, Relevan, ...]
Posisi relevan pertama = 3
RR = 1/3 = 0.33

MRR = (1.0 + 0.33) / 2 = 0.67
```

---

#### 4. NDCG (Normalized Discounted Cumulative Gain)

**"Seberapa bagus ranking secara keseluruhan?"**

```
Formula:
DCG@K = Σ (2^rel_i - 1) / log2(i + 1)
NDCG@K = DCG@K / Ideal_DCG@K

Dimana:
- rel_i = relevansi dokumen di posisi i (0, 1, atau graded)
- Ideal_DCG = DCG jika urutan sempurna
```

---

### Pengujian Manual Saat Ini

**📁 File:** `apps/api/test-chat.mjs` (atau pengujian manual)

```javascript
// Contoh test cases yang sudah dijalankan
const testCases = [
  {
    query: "Apa syarat yudisium?",
    expectedTopics: ["syarat", "yudisium", "lulus", "IPK"],
    result: "PASS" // Retrieval mendapat chunk yang benar
  },
  {
    query: "Berapa IPK minimal lulus?",
    expectedTopics: ["IPK", "minimal", "2.00"],
    result: "PASS"
  },
  // ... 20 test cases
];

// Hasil: 18/20 = 90% akurasi
```

---

### Cara Evaluasi Formal (Future Work)

**1. Buat Ground Truth Dataset:**
```json
[
  {
    "query": "Apa syarat yudisium?",
    "relevant_chunk_ids": ["chunk_45", "chunk_12", "chunk_78"]
  },
  {
    "query": "Bagaimana prosedur cuti?",
    "relevant_chunk_ids": ["chunk_101", "chunk_102"]
  }
]
```

**2. Implementasi Evaluator:**
```javascript
function evaluateRetrieval(query, retrievedIds, groundTruth) {
  const relevant = groundTruth[query];
  
  // Precision
  const truePositives = retrievedIds.filter(id => relevant.includes(id));
  const precision = truePositives.length / retrievedIds.length;
  
  // Recall
  const recall = truePositives.length / relevant.length;
  
  // F1
  const f1 = 2 * (precision * recall) / (precision + recall);
  
  return { precision, recall, f1 };
}
```

---

### Diagram Evaluasi

```
┌─────────────────────────────────────────────────────────────────┐
│                   RETRIEVAL EVALUATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GROUND TRUTH (Manual labeling):                                │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Query: "Syarat yudisium"                           │       │
│  │  Relevant: [chunk_45, chunk_12, chunk_78, chunk_99] │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  RETRIEVAL RESULT:                                              │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Retrieved: [chunk_45, chunk_12, chunk_33, chunk_55]│       │
│  │              ✅        ✅        ❌         ❌       │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  METRICS:                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Precision@4 = 2/4 = 50%                            │       │
│  │  (2 relevan dari 4 yang di-retrieve)                │       │
│  │                                                      │       │
│  │  Recall@4 = 2/4 = 50%                               │       │
│  │  (2 ter-retrieve dari 4 yang relevan)               │       │
│  │                                                      │       │
│  │  MRR = 1/1 = 1.0                                    │       │
│  │  (Hasil relevan pertama di posisi 1)                │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Tabel Perbandingan Metrik

| Metrik | Apa yang diukur | Kapan penting |
|--------|-----------------|---------------|
| **Precision** | Akurasi hasil | Jika user hanya lihat top hasil |
| **Recall** | Coverage | Jika semua info penting harus dapat |
| **MRR** | Ranking kualitas | Jika user hanya butuh 1 jawaban benar |
| **NDCG** | Overall ranking | Jika urutan hasil penting |

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, untuk mengukur kualitas retrieval:"**

1. **"Metrik yang umum dipakai:"**
   - Precision: dari yang dapat, berapa yang benar?
   - Recall: dari yang benar, berapa yang dapat?
   - MRR: posisi hasil benar pertama
   - NDCG: kualitas ranking keseluruhan

2. **"Saat ini saya pakai pengujian manual"**
   - 20 test cases
   - 90% akurasi retrieval
   - Belum formal dengan ground truth

3. **"Untuk evaluasi formal perlu:"**
   - Ground truth dataset (label manual)
   - Script evaluasi otomatis
   - Ini bisa jadi bagian penelitian

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan Precision dan Recall
- [ ] Bisa jelaskan MRR
- [ ] Bisa jelaskan cara buat ground truth
- [ ] Bisa jelaskan hasil pengujian manual saat ini
