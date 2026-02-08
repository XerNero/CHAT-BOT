# Pertanyaan 18: Bagaimana Cara Kerja Cosine Similarity?

## Pertanyaan Dosen
> "Cosine Similarity itu cara kerjanya bagaimana? Rumusnya apa?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, Cosine Similarity menghitung kemiripan 2 vektor berdasarkan SUDUT antar vektor, bukan jarak.**

**Rumus:**
```
Cosine Similarity = (A · B) / (||A|| × ||B||)
```

**Range: -1 sampai 1**
- 1 = identik
- 0 = tidak ada hubungan
- -1 = berlawanan

**Ini yang dipakai Qdrant untuk mencari chunk yang mirip dengan pertanyaan."**

---

## 📖 Penjelasan Detail

### Apa Itu Cosine Similarity?

**Cosine Similarity** mengukur kemiripan berdasarkan **arah** vektor, bukan **panjang**.

```
Analogi:
- Dua orang menunjuk ke ARAH yang sama = mirip (meski beda jarak)
- Dua orang menunjuk ke ARAH berbeda = tidak mirip
```

---

### Visualisasi 2D

```
           ▲ Dimensi 2
           │
           │      B (persyaratan lulus)
           │     /
           │    /  θ = 15° (sudut kecil)
           │   /
           │  /
           │ / A (syarat yudisium)
           │/
           └──────────────────────► Dimensi 1

Cosine Similarity = cos(15°) ≈ 0.97 (sangat mirip!)


           ▲ Dimensi 2
           │
           │   C (resep masakan)
           │   |
           │   |  θ = 75° (sudut besar)
           │   |
           │  /
           │ / A (syarat yudisium)
           │/
           └──────────────────────► Dimensi 1

Cosine Similarity = cos(75°) ≈ 0.26 (tidak mirip)
```

---

### Formula Matematika

```
                  A · B (dot product)
Cosine(A, B) = ─────────────────────────
                ||A|| × ||B|| (magnitude)

Dimana:
- A · B = Σ(Aᵢ × Bᵢ) untuk setiap dimensi i
- ||A|| = √(Σ Aᵢ²) = panjang vektor A
- ||B|| = √(Σ Bᵢ²) = panjang vektor B
```

---

### Contoh Perhitungan Manual

**Sederhanakan ke 3 dimensi (bukan 4096):**

```
Vektor A (syarat yudisium): [0.8, 0.5, 0.2]
Vektor B (persyaratan lulus): [0.7, 0.6, 0.3]
Vektor C (resep masakan): [0.1, 0.2, 0.9]

Hitung A vs B:
───────────────
Dot product: (0.8×0.7) + (0.5×0.6) + (0.2×0.3) = 0.56 + 0.30 + 0.06 = 0.92

||A|| = √(0.8² + 0.5² + 0.2²) = √(0.64 + 0.25 + 0.04) = √0.93 ≈ 0.96
||B|| = √(0.7² + 0.6² + 0.3²) = √(0.49 + 0.36 + 0.09) = √0.94 ≈ 0.97

Cosine(A, B) = 0.92 / (0.96 × 0.97) = 0.92 / 0.93 ≈ 0.99

Kesimpulan: A dan B SANGAT MIRIP (0.99 mendekati 1)


Hitung A vs C:
───────────────
Dot product: (0.8×0.1) + (0.5×0.2) + (0.2×0.9) = 0.08 + 0.10 + 0.18 = 0.36

||A|| = 0.96 (sama seperti di atas)
||C|| = √(0.1² + 0.2² + 0.9²) = √(0.01 + 0.04 + 0.81) = √0.86 ≈ 0.93

Cosine(A, C) = 0.36 / (0.96 × 0.93) = 0.36 / 0.89 ≈ 0.40

Kesimpulan: A dan C TIDAK MIRIP (0.40 jauh dari 1)
```

---

### Kenapa Cosine, Bukan Euclidean?

| Metrik | Apa yang diukur | Kelebihan | Kekurangan |
|--------|-----------------|-----------|------------|
| **Cosine** | Sudut antar vektor | Tidak terpengaruh panjang | - |
| **Euclidean** | Jarak antar titik | Intuitif | Terpengaruh panjang |

**Masalah Euclidean:**
```
Vektor A: [1, 1, 1] (dokumen pendek)
Vektor B: [2, 2, 2] (dokumen panjang, topik sama!)
Vektor C: [1, 0, 0] (dokumen berbeda)

Euclidean Distance:
- A vs B = √((2-1)² + (2-1)² + (2-1)²) = √3 ≈ 1.73 (JAUH!)
- A vs C = √((1-1)² + (1-0)² + (1-0)²) = √2 ≈ 1.41 (Lebih dekat?)

Euclidean SALAH menganggap C lebih mirip A daripada B!

Cosine Similarity:
- A vs B = cos(0°) = 1.0 (IDENTIK - arah sama)
- A vs C = cos(45°) ≈ 0.58 (Tidak identik)

Cosine BENAR: A dan B memang identik maknanya!
```

---

### Implementasi di Qdrant

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 183-186

```javascript
// Buat collection dengan Cosine distance
await qdrant.createCollection(COLLECTION_NAME, {
  vectors: { 
    size: vectorSize,      // 4096 dimensi
    distance: "Cosine"     // Metrik: Cosine Similarity
  },
});
```

**📍 Baris:** 439-447

```javascript
// Vector search menggunakan Cosine Similarity
const vectorHits = await qdrant.search(COLLECTION_NAME, {
  vector: qVec,         // Vektor pertanyaan
  limit: topK * 2,
  with_payload: true,
});

// Qdrant akan return chunks dengan Cosine Similarity tertinggi
// vectorHits[0].score = 0.95 (paling mirip)
// vectorHits[1].score = 0.89 (mirip)
// ...
```

---

### Diagram: Cosine di RAG

```
┌─────────────────────────────────────────────────────────────────┐
│                COSINE SIMILARITY IN RAG                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Query di-embed                                         │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Question: "Apa syarat yudisium?"                    │       │
│  │  Query Vector: [0.8, 0.5, 0.2, ...] (4096 dim)      │       │
│  └─────────────────────────────────────────────────────┘       │
│                           │                                      │
│                           ▼                                      │
│  Step 2: Hitung Cosine dengan SETIAP chunk di database          │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Chunk 1: [0.7, 0.6, 0.3, ...] → Cosine = 0.92     │       │
│  │  Chunk 2: [0.1, 0.2, 0.9, ...] → Cosine = 0.35     │       │
│  │  Chunk 3: [0.75, 0.55, 0.25, ...] → Cosine = 0.95  │ ← MAX │
│  │  Chunk 4: [0.3, 0.4, 0.6, ...] → Cosine = 0.58     │       │
│  │  ...                                                │       │
│  └─────────────────────────────────────────────────────┘       │
│                           │                                      │
│                           ▼                                      │
│  Step 3: Return top-K berdasarkan score                         │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Result:                                            │       │
│  │  1. Chunk 3 (score: 0.95) ← Paling relevan         │       │
│  │  2. Chunk 1 (score: 0.92)                          │       │
│  │  3. Chunk 4 (score: 0.58)                          │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, Cosine Similarity cara kerjanya:"**

1. **"Ukur sudut antar 2 vektor"**
   - Sudut kecil = mirip
   - Sudut besar = tidak mirip

2. **"Rumusnya"**
   ```
   Cosine = (A · B) / (||A|| × ||B||)
   ```
   - Dot product dibagi magnitude
   - Range: -1 sampai 1

3. **"Kenapa Cosine, bukan Euclidean?"**
   - Cosine tidak terpengaruh panjang vektor
   - Dokumen pendek dan panjang bisa sama-sama relevan

4. **"Di sistem saya"** (baris 183)
   - Qdrant dikonfigurasi pakai `distance: "Cosine"`
   - Setiap search, Qdrant hitung cosine semua vektor
   - Return yang paling tinggi

---

## ✅ Checklist Pemahaman

- [ ] Bisa tulis formula Cosine Similarity
- [ ] Bisa hitung manual dengan contoh
- [ ] Bisa jelaskan kenapa Cosine lebih baik dari Euclidean
- [ ] Bisa tunjukkan konfigurasi di kode (baris 183)
