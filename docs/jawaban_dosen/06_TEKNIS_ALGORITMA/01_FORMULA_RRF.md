# Pertanyaan 4: Bagaimana Menghitung Skor RRF?

## Pertanyaan Dosen
> "Bagaimana cara kamu menuntun skor ini? Ada formula, ada fungsi kan? Ada hitungan kan? Sejauh, berarti itu berdasarkan data."

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, saya pakai formula RRF (Reciprocal Rank Fusion) untuk menggabungkan hasil dari 2 pencarian:**

```
Skor = 1/(60 + rank_vector) + 1/(60 + rank_bm25)
```

**Chunk yang bagus di KEDUA pencarian akan mendapat skor tertinggi dan dipilih."**

---

## 📖 Penjelasan Detail untuk Dosen

### Apa Itu RRF?

**RRF = Reciprocal Rank Fusion**

- Teknik untuk menggabungkan hasil dari BEBERAPA sistem ranking
- Dalam kasus kita: Vector Search + BM25 Search
- Ditemukan oleh Cormack et al., 2009

**Keuntungan RRF:**
- ✅ Tidak perlu normalisasi skor (berbeda dengan weighted average)
- ✅ Sederhana tapi efektif
- ✅ Proven di banyak research

---

### Formula RRF

```
           N
RRF(d) =  Σ   1 / (k + rank_i(d))
          i=1

Dimana:
- d = dokumen/chunk
- N = jumlah sistem ranking (dalam kasus kita: 2)
- k = konstanta smoothing (default: 60)
- rank_i(d) = ranking dokumen d di sistem i
```

**Dalam kasus saya:**
```
RRF(chunk) = 1/(60 + rank_vector) + 1/(60 + rank_bm25)
```

---

### Kode Fungsi RRF

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 311-316  
**📋 Fungsi:** `rrfFuse()`

```javascript
function rrfFuse(rankA, rankB, k = 60) {
  const scores = new Map();
  
  // Iterasi ranking dari Vector Search
  for (const [id, r] of rankA.entries()) {
    // r = rank (1, 2, 3, ...)
    // scores = 1/(60 + rank)
    scores.set(id, (scores.get(id) || 0) + 1 / (k + r));
  }
  
  // Iterasi ranking dari BM25 Search
  for (const [id, r] of rankB.entries()) {
    // Tambahkan skor dari BM25
    scores.set(id, (scores.get(id) || 0) + 1 / (k + r));
  }
  
  return scores;  // Map<chunk_id, rrf_score>
}
```

**Penjelasan baris per baris:**

| Baris | Kode | Penjelasan |
|-------|------|------------|
| 311 | `function rrfFuse(rankA, rankB, k = 60)` | Terima 2 ranking dan konstanta k=60 |
| 312 | `const scores = new Map()` | Map untuk menyimpan skor RRF |
| 313 | `for (const [id, r] of rankA.entries())` | Loop setiap chunk dari Vector Search |
| 313 | `1 / (k + r)` | Hitung skor: 1/(60 + rank) |
| 314 | `for (const [id, r] of rankB.entries())` | Loop setiap chunk dari BM25 |
| 314 | `(scores.get(id) \|\| 0) + 1 / (k + r)` | Tambahkan ke skor yang sudah ada |
| 316 | `return scores` | Return Map dengan skor final |

---

### Penggunaan dalam Hybrid Retrieval

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 446-467

```javascript
async function hybridRetrieve(queryText, topK = 6) {
  // ... embedding dan pencarian ...

  // 1. Buat ranking dari Vector Search
  const vectorRank = new Map();
  for (let i = 0; i < vectorHits.length; i++) {
    vectorRank.set(String(vectorHits[i].id), i + 1);  // Rank 1, 2, 3, ...
  }

  // 2. Buat ranking dari BM25 Search
  const keywordRank = new Map();
  for (let i = 0; i < bm25Scored.length; i++) {
    keywordRank.set(bm25Scored[i].id, i + 1);  // Rank 1, 2, 3, ...
  }

  // 3. Gabungkan dengan RRF
  const fused = rrfFuse(vectorRank, keywordRank, 60);

  // 4. Urutkan berdasarkan skor tertinggi
  const fusedSorted = Array.from(fused.entries())
    .sort((a, b) => b[1] - a[1])  // Descending (tertinggi dulu)
    .slice(0, topK);              // Ambil top-K

  // ... return hasil ...
}
```

---

### Contoh Perhitungan Manual

**Skenario:** User bertanya "Apa syarat yudisium?"

**Hasil Vector Search:**
| Rank | Chunk ID | Isi Singkat |
|------|----------|-------------|
| 1 | chunk_45 | "Syarat yudisium adalah..." |
| 2 | chunk_12 | "Persyaratan kelulusan meliputi..." |
| 3 | chunk_78 | "Mahasiswa yang ingin lulus harus..." |
| 4 | chunk_99 | "IPK minimum untuk yudisium..." |

**Hasil BM25 Search:**
| Rank | Chunk ID | Isi Singkat |
|------|----------|-------------|
| 1 | chunk_12 | "Persyaratan kelulusan meliputi..." |
| 2 | chunk_99 | "IPK minimum untuk yudisium..." |
| 3 | chunk_45 | "Syarat yudisium adalah..." |
| 4 | chunk_33 | "Yudisium dilaksanakan setiap..." |

---

**Perhitungan RRF:**

```
chunk_45:
  Vector rank = 1  →  1/(60+1) = 1/61 = 0.01639
  BM25 rank   = 3  →  1/(60+3) = 1/63 = 0.01587
  RRF score   = 0.01639 + 0.01587 = 0.03226

chunk_12:
  Vector rank = 2  →  1/(60+2) = 1/62 = 0.01613
  BM25 rank   = 1  →  1/(60+1) = 1/61 = 0.01639
  RRF score   = 0.01613 + 0.01639 = 0.03252  ✅ TERTINGGI

chunk_78:
  Vector rank = 3  →  1/(60+3) = 1/63 = 0.01587
  BM25 rank   = -  →  0 (tidak ada di BM25)
  RRF score   = 0.01587 + 0 = 0.01587

chunk_99:
  Vector rank = 4  →  1/(60+4) = 1/64 = 0.01562
  BM25 rank   = 2  →  1/(60+2) = 1/62 = 0.01613
  RRF score   = 0.01562 + 0.01613 = 0.03175

chunk_33:
  Vector rank = -  →  0 (tidak ada di Vector)
  BM25 rank   = 4  →  1/(60+4) = 1/64 = 0.01562
  RRF score   = 0 + 0.01562 = 0.01562
```

**Hasil Akhir (Sorted):**

| Rank | Chunk ID | RRF Score | Penjelasan |
|------|----------|-----------|------------|
| 1 | chunk_12 | 0.03252 | Rank 2 Vector + Rank 1 BM25 |
| 2 | chunk_45 | 0.03226 | Rank 1 Vector + Rank 3 BM25 |
| 3 | chunk_99 | 0.03175 | Rank 4 Vector + Rank 2 BM25 |
| 4 | chunk_78 | 0.01587 | Hanya di Vector (rank 3) |
| 5 | chunk_33 | 0.01562 | Hanya di BM25 (rank 4) |

**Kesimpulan:**
- `chunk_12` menang karena bagus di KEDUA pencarian
- Chunk yang hanya bagus di satu pencarian (78, 33) dapat skor rendah

---

### Diagram Visual RRF

```
┌─────────────────────────────────────────────────────────────────┐
│                    RRF FUSION PROCESS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  VECTOR SEARCH RESULTS:         BM25 SEARCH RESULTS:            │
│  ┌─────────────────────┐        ┌─────────────────────┐         │
│  │ Rank 1: chunk_45    │        │ Rank 1: chunk_12    │         │
│  │ Rank 2: chunk_12    │        │ Rank 2: chunk_99    │         │
│  │ Rank 3: chunk_78    │        │ Rank 3: chunk_45    │         │
│  │ Rank 4: chunk_99    │        │ Rank 4: chunk_33    │         │
│  └──────────┬──────────┘        └──────────┬──────────┘         │
│             │                              │                     │
│             └──────────┬───────────────────┘                     │
│                        ▼                                         │
│  ┌─────────────────────────────────────────┐                    │
│  │              RRF FUSION                  │                    │
│  │                                          │                    │
│  │  Formula: score = 1/(60+r₁) + 1/(60+r₂) │                    │
│  │                                          │                    │
│  │  chunk_12: 1/62 + 1/61 = 0.03252 ✅     │                    │
│  │  chunk_45: 1/61 + 1/63 = 0.03226        │                    │
│  │  chunk_99: 1/64 + 1/62 = 0.03175        │                    │
│  │  chunk_78: 1/63 + 0    = 0.01587        │                    │
│  │  chunk_33: 0    + 1/64 = 0.01562        │                    │
│  └─────────────────────────────────────────┘                    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────┐                    │
│  │          FINAL RANKING (Top-K)          │                    │
│  │                                          │                    │
│  │  1. chunk_12 (0.03252) ← dipilih        │                    │
│  │  2. chunk_45 (0.03226) ← dipilih        │                    │
│  │  3. chunk_99 (0.03175) ← dipilih        │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Kenapa k = 60?

**Konstanta k berfungsi untuk "smoothing":**

| k value | Efek |
|---------|------|
| k kecil (5-10) | Rank 1 sangat dominan, rank lain hampir diabaikan |
| k besar (100+) | Semua rank hampir sama bobotnya |
| k = 60 | **Sweet spot** - rank tinggi masih penting tapi tidak terlalu dominan |

**Contoh perbandingan k:**

```
Dengan k = 5:
  Rank 1: 1/6  = 0.167
  Rank 2: 1/7  = 0.143  (turun 14%)
  Rank 3: 1/8  = 0.125  (turun 25%)

Dengan k = 60:
  Rank 1: 1/61 = 0.0164
  Rank 2: 1/62 = 0.0161  (turun 1.8%)
  Rank 3: 1/63 = 0.0159  (turun 3%)
```

**k = 60 membuat:**
- Rank 1 masih lebih penting dari rank 10
- Tapi perbedaannya tidak terlalu ekstrem
- Chunk rank 2-3 masih punya kesempatan

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, begini cara saya menghitung skor:"**

1. **"Ada 2 pencarian paralel:"**
   - Vector Search → hasil diranking (1, 2, 3, ...)
   - BM25 Search → hasil diranking (1, 2, 3, ...)

2. **"Kedua ranking digabung dengan formula RRF"** (baris 311-316)
   ```
   Skor = 1/(60 + rank_vector) + 1/(60 + rank_bm25)
   ```

3. **"Chunk yang skor tertinggi dipilih"**
   - Chunk yang bagus di KEDUA pencarian → skor tinggi
   - Chunk yang hanya bagus di satu → skor rendah

4. **"Contoh perhitungannya, Pak:"**
   - chunk_12: rank 2 di Vector, rank 1 di BM25
   - Skor = 1/62 + 1/61 = 0.032
   - Ini tertinggi, jadi dipilih

**"Kenapa pakai RRF, Pak?"**
- Tidak perlu normalisasi skor
- Sudah proven di research (Cormack et al., 2009)
- Sederhana tapi efektif

---

## ✅ Checklist Pemahaman

- [ ] Bisa tulis formula RRF
- [ ] Bisa jelaskan fungsi konstanta k=60
- [ ] Bisa hitung manual dengan contoh
- [ ] Bisa tunjukkan kode `rrfFuse()` (baris 311-316)
- [ ] Bisa jelaskan kenapa chunk bagus di KEDUA pencarian menang
