# Pertanyaan 10: Apa Kelemahan RAG dan Cara Mengatasinya?

## Pertanyaan Dosen
> "RAG ini ada kelemahannya tidak? Bagaimana cara mengatasinya?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, RAG ada beberapa kelemahan:**
1. **Retrieval tidak akurat** → Solusi: Hybrid Retrieval (Vector + BM25)
2. **Chunk terpotong** → Solusi: Smart Chunking dengan overlap
3. **Context terlalu panjang** → Solusi: Limit top-K chunks
4. **Single-hop kurang lengkap** → Solusi: Multi-hop RAG

**Semua sudah saya terapkan di sistem ini."**

---

## 📖 Kelemahan dan Solusi Detail

### 1. Retrieval Tidak Akurat

**Masalah:**
```
User: "Berapa IPK minimum lulus?"

Vector Search bisa gagal jika:
- Pertanyaan pendek (vektor kurang representatif)
- Istilah teknis berbeda (IPK vs Indeks Prestasi)
```

**Solusi: Hybrid Retrieval**

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 436-486

```javascript
async function hybridRetrieve(queryText, topK = 6) {
  // 1. Vector Search - semantic similarity
  const vectorHits = await qdrant.search(COLLECTION_NAME, {
    vector: qVec,
    limit: topK * 2,
  });

  // 2. BM25 Search - keyword matching
  const bm25Scored = keywordCache.points
    .map((p) => ({
      score: bm25Score(qToks, docToks, df, avgdl),
    }));

  // 3. Combine with RRF
  const fused = rrfFuse(vectorRank, keywordRank, 60);
}
```

**Kenapa ini mengatasi:**
- Vector Search → mengerti sinonim
- BM25 Search → akurat untuk kata kunci spesifik
- RRF Fusion → ambil yang terbaik dari kedua metode

---

### 2. Chunk Terpotong di Tengah Konteks

**Masalah:**
```
PDF Original:
"Pasal 10. Syarat yudisium adalah:
1. Lulus semua mata kuliah
2. IPK minimal 2.00
3. Tidak ada nilai E"

Chunking Bodoh (potong per 500 karakter):
Chunk 1: "Pasal 10. Syarat yudisium adalah: 1. Lulus semua mata"
Chunk 2: "kuliah 2. IPK minimal 2.00 3. Tidak ada nilai E"

Problem: Chunk 2 tidak lengkap, kehilangan konteks "Pasal 10"
```

**Solusi: Smart Chunking dengan Overlap**

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 81-156

```javascript
function chunkText(text, maxChars = 800, overlap = 150) {
  // 1. Split berdasarkan paragraf (bukan karakter sembarang)
  const paragraphs = cleaned.split(/\n\n+/);

  // 2. Deteksi heading (BAB, Pasal) sebagai pemisah alami
  const isNewSection = /^(BAB|BAGIAN|PASAL)/i.test(para);

  // 3. Overlap: 2 kalimat terakhir diulang di chunk berikutnya
  const sentences = currentChunk.split(/(?<=[.!?])\s+/);
  const overlapText = sentences.slice(-2).join(" ");
}
```

**Hasil dengan Smart Chunking:**
```
Chunk 1: "Pasal 10. Syarat yudisium adalah: 1. Lulus semua mata kuliah 2. IPK minimal 2.00"
Chunk 2: "2. IPK minimal 2.00 3. Tidak ada nilai E. Pasal 11..." ← overlap!
```

---

### 3. Context Terlalu Panjang

**Masalah:**
```
LLM punya context window terbatas:
- llama3:8b ≈ 8,000 tokens
- Jika masukkan 50 chunks, bisa overflow

Efek:
- LLM bingung dengan terlalu banyak info
- Token awal bisa "dilupakan" (lost in the middle problem)
```

**Solusi: Limit Top-K Chunks**

**📍 Baris:** 721, 835-838

```javascript
// Single-hop: ambil 8 chunks terbaik
const contextChunks = await hybridRetrieve(question, 8);

// Multi-hop: 4 chunks per sub-query × 4 = 16 max
const [overviewChunks, detailChunks, aturanChunks, penutupChunks] = await Promise.all([
  hybridRetrieve(subQueries.overview, 4),
  hybridRetrieve(subQueries.detail, 4),
  hybridRetrieve(subQueries.aturan, 4),
  hybridRetrieve(subQueries.penutup, 4),
]);
```

---

### 4. Single-hop Kurang Lengkap

**Masalah:**
```
User: "Jelaskan proses yudisium lengkap"

Single-hop hanya cari 1x:
- Mungkin dapat chunk tentang "syarat"
- Tapi tidak dapat chunk tentang "prosedur" atau "jadwal"

Jawaban jadi tidak lengkap
```

**Solusi: Multi-hop RAG**

**📍 Baris:** 491-543, 832-839

```javascript
// Pecah pertanyaan jadi 4 aspek
const subQueries = await decomposeQuery(question);
// {
//   overview: "Apa itu yudisium?",
//   detail: "Apa syarat yudisium?",
//   aturan: "Apa batasan yudisium?",
//   penutup: "Apa yang terjadi setelah yudisium?"
// }

// Cari masing-masing → dapat konteks lebih lengkap
```

---

### 5. LLM Tidak Patuh Instruksi

**Masalah:**
```
System prompt: "Jawab hanya dari context"

Tapi LLM kadang:
- Tidak kasih sitasi
- Bocor aturan internal ("Berdasarkan instruksi saya...")
- Halusinasi meski sudah ada context
```

**Solusi: Multi-layer Validation**

**📍 Baris:** 782-799, 347-379

```javascript
// Layer 1: Retry jika tidak ada sitasi
if (!hasCitations(answer) && !isNotFoundText(answer)) {
  const chat2 = await ollamaChat(repairMessages, 0.0);
}

// Layer 2: Fallback paksa sitasi
answer = ensureCitationsInText(answer, "[#1]");

// Layer 3: Bersihkan bocoran meta
answer = stripMetaRules(answer);
```

---

## 📊 Tabel Ringkasan

| Kelemahan | Solusi | Baris Kode |
|-----------|--------|------------|
| Retrieval tidak akurat | Hybrid Retrieval | 436-486 |
| Chunk terpotong | Smart Chunking + Overlap | 81-156 |
| Context terlalu panjang | Limit Top-K | 721, 835 |
| Single-hop kurang lengkap | Multi-hop RAG | 491-543, 832 |
| LLM tidak patuh | Multi-layer Validation | 782-799 |

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, RAG memang ada kelemahannya, tapi sudah saya atasi:"**

1. **"Retrieval bisa tidak akurat"**
   - Solusi: Hybrid Retrieval (Vector + BM25 + RRF)
   - Baris 436-486

2. **"Chunk bisa terpotong di tengah"**
   - Solusi: Smart Chunking yang hormati paragraf + overlap
   - Baris 81-156

3. **"Context bisa terlalu panjang"**
   - Solusi: Limit top-K (8 untuk single-hop, 4×4 untuk multi-hop)
   - Baris 721, 835

4. **"Single-hop kurang lengkap"**
   - Solusi: Multi-hop RAG dengan 4 sub-query
   - Baris 491-543

5. **"LLM kadang tidak patuh"**
   - Solusi: Retry + fallback sitasi + cleanup
   - Baris 782-799

---

## ✅ Checklist Pemahaman

- [ ] Bisa sebutkan 5 kelemahan RAG
- [ ] Bisa jelaskan solusi untuk masing-masing
- [ ] Bisa tunjukkan baris kode yang relevan
