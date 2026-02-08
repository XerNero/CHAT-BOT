# Pertanyaan 19: Apa Itu BM25 dan Bagaimana Formulanya?

## Pertanyaan Dosen
> "BM25 itu apa? Formulanya bagaimana?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, BM25 adalah algoritma ranking untuk pencarian teks berbasis keyword.**

**Rumus:**
```
BM25(Q, D) = Σ IDF(q) × [TF(q,D) × (k1 + 1)] / [TF(q,D) + k1 × (1 - b + b × |D|/avgdl)]
```

**Inti:**
- **TF (Term Frequency)** - Kata sering muncul = lebih relevan
- **IDF (Inverse Document Frequency)** - Kata langka = lebih penting
- **Document Length** - Dokumen panjang di-normalize"

---

## 📖 Penjelasan Detail

### Apa Itu BM25?

**BM25 = Best Match 25**

- Algoritma ranking untuk information retrieval
- Dikembangkan tahun 1990an
- Masih dipakai di search engine modern (Elasticsearch, Solr)
- Menghitung "skor relevansi" dokumen terhadap query

---

### Komponen BM25

#### 1. TF (Term Frequency)

**Semakin sering kata muncul di dokumen, semakin relevan.**

```
Document: "Syarat yudisium adalah syarat yang harus dipenuhi untuk yudisium"

Query: "syarat yudisium"

TF("syarat") = 2 (muncul 2 kali)
TF("yudisium") = 2 (muncul 2 kali)

Dokumen ini sangat relevan karena kata kunci sering muncul!
```

---

#### 2. IDF (Inverse Document Frequency)

**Kata yang jarang muncul di seluruh dokumen lebih penting.**

```
Koleksi 100 dokumen:
- "yang" muncul di 95 dokumen → IDF rendah (kata umum)
- "yudisium" muncul di 5 dokumen → IDF tinggi (kata spesifik)

Jika query mengandung "yudisium", dokumen yang punya "yudisium" 
lebih bernilai daripada dokumen yang punya "yang"
```

**Formula:**
```
IDF(q) = log((N - n(q) + 0.5) / (n(q) + 0.5) + 1)

Dimana:
- N = total dokumen
- n(q) = dokumen yang mengandung term q
```

---

#### 3. Document Length Normalization

**Dokumen panjang tidak otomatis lebih relevan.**

```
Document A (100 kata): "Syarat yudisium adalah lulus..."
Document B (1000 kata): "... syarat ... (banyak filler) ... yudisium ..."

Tanpa normalisasi: B bisa kalah karena "syarat" cuma 1% dari total
Dengan normalisasi: B diperhitungkan secara fair
```

---

### Formula Lengkap BM25

```
BM25(Q, D) = Σ IDF(qᵢ) × [f(qᵢ,D) × (k₁ + 1)] / [f(qᵢ,D) + k₁ × (1 - b + b × |D|/avgdl)]

Dimana:
- Q = Query (kumpulan term)
- D = Document
- qᵢ = term ke-i dalam query
- f(qᵢ,D) = frekuensi term qᵢ dalam dokumen D (TF)
- |D| = panjang dokumen D (jumlah kata)
- avgdl = rata-rata panjang dokumen di koleksi
- k₁ = parameter saturation (biasanya 1.2-2.0)
- b = parameter length normalization (biasanya 0.75)
```

---

### Kode BM25 di Sistem Kita

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 250-270

```javascript
function bm25Score(queryTokens, docTokens, df, avgdl, k1 = 1.5, b = 0.75) {
  // Hitung frekuensi setiap token di dokumen
  const docTf = new Map();
  for (const t of docTokens) {
    docTf.set(t, (docTf.get(t) || 0) + 1);
  }

  let score = 0;
  const docLen = docTokens.length;
  const totalDocs = df.get("__N__") || 1;

  for (const q of queryTokens) {
    // TF: frekuensi query term di dokumen
    const tf = docTf.get(q) || 0;
    if (tf === 0) continue;  // Term tidak ada di dokumen

    // DF: berapa dokumen yang mengandung term ini
    const docFreq = df.get(q) || 0;

    // IDF: inverse document frequency
    const idf = Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));

    // BM25 scoring formula
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / avgdl));

    score += idf * (numerator / denominator);
  }

  return score;
}
```

---

### Contoh Perhitungan Manual

**Setup:**
```
Total dokumen (N) = 100
Rata-rata panjang (avgdl) = 200 kata
k1 = 1.5
b = 0.75

Query: "syarat yudisium"
Document: "Syarat yudisium adalah syarat yang harus dipenuhi" (8 kata)

Term frequencies in doc:
- "syarat": TF = 2
- "yudisium": TF = 1

Document frequency in collection:
- "syarat" muncul di 20 dokumen → n(syarat) = 20
- "yudisium" muncul di 5 dokumen → n(yudisium) = 5
```

**Hitung IDF:**
```
IDF("syarat") = log(1 + (100 - 20 + 0.5) / (20 + 0.5))
              = log(1 + 80.5 / 20.5)
              = log(1 + 3.93)
              = log(4.93)
              ≈ 1.60

IDF("yudisium") = log(1 + (100 - 5 + 0.5) / (5 + 0.5))
                = log(1 + 95.5 / 5.5)
                = log(1 + 17.36)
                = log(18.36)
                ≈ 2.91  ← Lebih tinggi karena kata langka!
```

**Hitung BM25 Score:**
```
Untuk "syarat" (TF=2, docLen=8):
numerator = 2 × (1.5 + 1) = 5
denominator = 2 + 1.5 × (1 - 0.75 + 0.75 × 8/200)
            = 2 + 1.5 × (0.25 + 0.03)
            = 2 + 0.42
            = 2.42
score_syarat = 1.60 × (5 / 2.42) = 1.60 × 2.07 = 3.31

Untuk "yudisium" (TF=1, docLen=8):
numerator = 1 × (1.5 + 1) = 2.5
denominator = 1 + 1.5 × (0.25 + 0.03) = 1.42
score_yudisium = 2.91 × (2.5 / 1.42) = 2.91 × 1.76 = 5.12

TOTAL BM25 = 3.31 + 5.12 = 8.43
```

---

### Diagram BM25 di Hybrid Retrieval

```
┌─────────────────────────────────────────────────────────────────┐
│                    BM25 IN HYBRID RETRIEVAL                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Query: "syarat yudisium"                                       │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐                                            │
│  │   Tokenize      │  ["syarat", "yudisium"]                    │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ Filter Stopwords│  (hapus kata tidak penting)                │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────┐       │
│  │           Hitung BM25 untuk SETIAP dokumen          │       │
│  │                                                      │       │
│  │  Doc 1: BM25 = 8.43  ← Mengandung "syarat" 2x       │       │
│  │  Doc 2: BM25 = 3.21  ← Mengandung "syarat" 1x       │       │
│  │  Doc 3: BM25 = 0.00  ← Tidak mengandung kata query  │       │
│  │  Doc 4: BM25 = 5.67  ← Mengandung "yudisium" 1x     │       │
│  │  ...                                                 │       │
│  └─────────────────────────────────────────────────────┘       │
│           │                                                      │
│           ▼                                                      │
│  Sort by score descending → Rank 1, 2, 3, ...                   │
│           │                                                      │
│           ▼                                                      │
│  Gabungkan dengan Vector Search ranking via RRF                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, BM25 cara kerjanya:"**

1. **"Hitung Term Frequency (TF)"**
   - Kata sering muncul di dokumen = lebih relevan
   - "syarat" muncul 2x → TF = 2

2. **"Hitung Inverse Document Frequency (IDF)"**
   - Kata langka lebih penting
   - "yudisium" hanya di 5 dari 100 dokumen → IDF tinggi

3. **"Normalize panjang dokumen"**
   - Dokumen panjang tidak otomatis menang
   - Parameter b = 0.75

4. **"Hitung skor akhir"** (baris 250-270)
   - Gabungkan TF × IDF dengan normalisasi
   - Dokumen skor tertinggi = paling relevan

**"Formula:"**
```
BM25 = Σ IDF × (TF × (k1+1)) / (TF + k1 × normalization)
```

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan TF (Term Frequency)
- [ ] Bisa jelaskan IDF (Inverse Document Frequency)
- [ ] Bisa jelaskan document length normalization
- [ ] Bisa tulis formula BM25
- [ ] Bisa tunjukkan kode BM25 (baris 250-270)
