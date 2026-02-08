# Pertanyaan 1: Bagaimana Cara RAG Mengambil Data?

## Pertanyaan Dosen
> "Bagaimana kamu cara bikin RAG ini mengambilkan data? Gimana cara kamu menyiapkan datanya supaya bisa dibaca dalam RAG?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, RAG saya mengambil data dengan 2 cara sekaligus (Hybrid):**
1. **Vector Search** - Cari berdasarkan makna/semantik
2. **BM25 Search** - Cari berdasarkan kata kunci

**Hasilnya digabung dengan formula RRF, yang skornya paling tinggi diambil."**

---

## 📖 Penjelasan Detail untuk Dosen

### Langkah 1: User Mengetik Pertanyaan

```
User: "Apa syarat yudisium?"
```

Pertanyaan ini dikirim ke backend via API `/chat-multihop`.

---

### Langkah 2: Pertanyaan Diubah Jadi Vektor

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 158-176  
**📋 Fungsi:** `embedWithOllama()`

```javascript
async function embedWithOllama(text) {
  // Kirim pertanyaan ke Ollama untuk di-embed
  const { body, statusCode } = await request(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 
      model: EMBED_MODEL,           // "llama3:8b"
      prompt: String(text || "")    // "Apa syarat yudisium?"
    }),
  });

  const json = await body.json();
  return json.embedding;  // [0.123, -0.456, 0.789, ...] (4096 angka)
}
```

**Penjelasan:**
- Pertanyaan "Apa syarat yudisium?" → dikirim ke Ollama
- Ollama mengembalikan **array 4096 angka** (vektor)
- Vektor ini merepresentasikan **makna** pertanyaan

---

### Langkah 3: Vector Search di Qdrant

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 439-448  
**📋 Di dalam fungsi:** `hybridRetrieve()`

```javascript
// Cari chunk yang vektornya mirip dengan vektor pertanyaan
const vectorHits = await qdrant.search(COLLECTION_NAME, {
  vector: qVec,        // Vektor dari pertanyaan user
  limit: topK * 2,     // Ambil 12 hasil (topK=6, jadi 6*2=12)
  with_payload: true,  // Sertakan teks asli
  with_vector: false,  // Tidak perlu vektor, hemat bandwidth
});

// Buat ranking dari hasil
const vectorRank = new Map();
for (let i = 0; i < vectorHits.length; i++) {
  vectorRank.set(String(vectorHits[i].id), i + 1);  // Rank 1, 2, 3, ...
}
```

**Penjelasan:**
- Qdrant mencari chunk yang **vektornya paling mirip** dengan vektor pertanyaan
- Menggunakan **Cosine Similarity** (sudut antar vektor)
- Hasil diranking: rank 1 = paling mirip

**Contoh Hasil Vector Search:**
| Rank | Chunk ID | Skor Similarity |
|------|----------|-----------------|
| 1 | chunk_45 | 0.89 |
| 2 | chunk_12 | 0.85 |
| 3 | chunk_78 | 0.82 |

---

### Langkah 4: BM25 Search (Keyword Matching)

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 451-464  
**📋 Di dalam fungsi:** `hybridRetrieve()`

```javascript
// 1. Tokenisasi pertanyaan
const qToks = filterStopwords(tokenize(queryText));
// "Apa syarat yudisium?" → ["syarat", "yudisium"]

// 2. Hitung BM25 score untuk setiap chunk
const bm25Scored = keywordCache.points
  .map((p) => {
    // Tokenisasi teks chunk
    const docToks = filterStopwords(tokenize(p.payload.text));
    
    // Hitung skor BM25
    return { 
      id: String(p.id), 
      score: bm25Score(qToks, docToks, df, avgdl),  // Fungsi BM25
      payload: p.payload 
    };
  })
  .filter((x) => x.score > 0)      // Hanya yang ada kata kunci
  .sort((a, b) => b.score - a.score)  // Urutkan skor tertinggi
  .slice(0, topK * 2);             // Ambil top 12
```

**Penjelasan:**
- Pertanyaan dipecah jadi kata-kata: `["syarat", "yudisium"]`
- Stopwords dihapus: "apa" dihapus karena tidak bermakna
- Setiap chunk dihitung **skor BM25** berdasarkan:
  - **TF (Term Frequency)** - Berapa kali kata muncul di chunk
  - **IDF (Inverse Document Frequency)** - Kata langka lebih penting
  - **Panjang dokumen** - Chunk pendek dengan kata kunci lebih relevan

**Contoh Hasil BM25:**
| Rank | Chunk ID | Skor BM25 |
|------|----------|-----------|
| 1 | chunk_12 | 5.67 |
| 2 | chunk_45 | 4.23 |
| 3 | chunk_99 | 3.89 |

---

### Langkah 5: Gabungkan dengan RRF (Reciprocal Rank Fusion)

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 311-316 dan 466-467  
**📋 Fungsi:** `rrfFuse()`

```javascript
function rrfFuse(rankA, rankB, k = 60) {
  const scores = new Map();
  
  // Skor dari Vector Search
  for (const [id, r] of rankA.entries()) {
    scores.set(id, (scores.get(id) || 0) + 1 / (k + r));
  }
  
  // Skor dari BM25 Search
  for (const [id, r] of rankB.entries()) {
    scores.set(id, (scores.get(id) || 0) + 1 / (k + r));
  }
  
  return scores;
}

// Penggunaan:
const fused = rrfFuse(vectorRank, keywordRank, 60);
const fusedSorted = Array.from(fused.entries())
  .sort((a, b) => b[1] - a[1])  // Skor tertinggi dulu
  .slice(0, topK);              // Ambil top-K
```

**Penjelasan Formula:**

```
RRF_score = 1/(60 + rank_vector) + 1/(60 + rank_bm25)
```

**Contoh Perhitungan Manual:**

| Chunk | Rank Vector | Rank BM25 | Perhitungan | RRF Score |
|-------|-------------|-----------|-------------|-----------|
| chunk_45 | 1 | 2 | 1/61 + 1/62 | **0.0325** |
| chunk_12 | 2 | 1 | 1/62 + 1/61 | **0.0325** |
| chunk_78 | 3 | 5 | 1/63 + 1/65 | 0.0312 |
| chunk_99 | 10 | 3 | 1/70 + 1/63 | 0.0301 |

**Hasil akhir:** Chunk 45 dan 12 dipilih karena skor tertinggi.

---

### Langkah 6: Return Chunk Terbaik

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 473-485

```javascript
return fusedSorted
  .map(([id, score]) => {
    const payload = idToPayload.get(id);
    if (!payload?.text) return null;
    return {
      id,                           // ID chunk di database
      score,                        // Skor RRF
      source_file: payload.source_file,  // "peraturan_akademik.pdf"
      chunk_index: payload.chunk_index,  // 45
      text: payload.text,           // "Syarat yudisium adalah..."
    };
  })
  .filter(Boolean);
```

**Output:**
```javascript
[
  {
    id: "chunk_45",
    score: 0.0325,
    source_file: "peraturan_akademik.pdf",
    chunk_index: 45,
    text: "Syarat yudisium adalah mahasiswa harus menyelesaikan..."
  },
  // ... chunk lainnya
]
```

---

## 📊 Diagram Alur Lengkap

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID RETRIEVAL FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: "Apa syarat yudisium?"                                   │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐                                            │
│  │ embedWithOllama │ → Vektor [0.123, -0.456, ...] (4096 dim)   │
│  └─────────────────┘                                            │
│         │                                                        │
│         ├────────────────────────────────────┐                  │
│         ▼                                    ▼                  │
│  ┌─────────────────┐                 ┌─────────────────┐        │
│  │ VECTOR SEARCH   │                 │ BM25 SEARCH     │        │
│  │ (Qdrant)        │                 │ (Keyword Cache) │        │
│  │                 │                 │                 │        │
│  │ Cari vektor     │                 │ Cari kata       │        │
│  │ yang mirip      │                 │ "syarat"        │        │
│  │                 │                 │ "yudisium"      │        │
│  └─────────────────┘                 └─────────────────┘        │
│         │                                    │                  │
│         │ Rank: 1,2,3,4...                   │ Rank: 1,2,3,4... │
│         │                                    │                  │
│         └──────────────┬─────────────────────┘                  │
│                        ▼                                        │
│               ┌─────────────────┐                               │
│               │ RRF FUSION      │                               │
│               │                 │                               │
│               │ Score = 1/(60+r)│                               │
│               │ dari kedua rank │                               │
│               └─────────────────┘                               │
│                        │                                        │
│                        ▼                                        │
│               ┌─────────────────┐                               │
│               │ TOP-K CHUNKS    │                               │
│               │                 │                               │
│               │ Chunk 45: 0.0325│                               │
│               │ Chunk 12: 0.0325│                               │
│               │ Chunk 78: 0.0312│                               │
│               └─────────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ PENTING: Hybrid Retrieval Dipakai di Single-hop DAN Multi-hop!

```
┌─────────────────────────────────────────────────────────────────┐
│          HYBRID RETRIEVAL = DIPAKAI DI KEDUANYA!                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SINGLE-HOP:                                                    │
│  Query → [Hybrid Retrieval: 1x] → LLM Generate                  │
│                                                                  │
│  MULTI-HOP:                                                     │
│  Query → LLM Decompose → [Hybrid Retrieval: 4x] → LLM Synthesize│
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Multi-hop TETAP pakai Hybrid Retrieval, bahkan 4x lebih banyak!│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Mode | Hybrid Retrieval | Penjelasan |
|------|------------------|------------|
| **Single-hop** | 1x | Langsung search dari query original |
| **Multi-hop** | 4x | Search untuk setiap sub-query (overview, detail, aturan, penutup) |

**Jadi Hybrid Retrieval adalah CORE dari RAG, dipakai baik Single-hop maupun Multi-hop!**

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, begini alur RAG saya mengambil data:"**

1. **"Pertanyaan user diubah jadi vektor"** (baris 158-176)
   - Model llama3:8b mengubah teks jadi 4096 angka
   - Angka-angka ini merepresentasikan makna

2. **"Lalu saya cari di 2 tempat sekaligus:"**
   - **Vector Search** (baris 439-448): Cari chunk yang maknanya mirip
   - **BM25 Search** (baris 451-464): Cari chunk yang ada kata kuncinya

3. **"Kedua hasil digabung dengan RRF"** (baris 311-316)
   - Formula: `1/(60 + rank)`
   - Chunk yang bagus di KEDUA pencarian → skor tertinggi

4. **"Hasilnya, saya dapat chunk yang paling relevan"**
   - Chunk ini nanti jadi context untuk LLM

**"Kenapa Hybrid, Pak?"**
- Vector Search → mengerti sinonim (misal: "syarat" = "persyaratan")
- BM25 Search → akurat untuk istilah teknis, nama, angka
- Gabungan keduanya → hasil lebih akurat

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan apa itu embedding dan fungsinya
- [ ] Bisa jelaskan cara kerja Vector Search
- [ ] Bisa jelaskan cara kerja BM25 Search
- [ ] Bisa jelaskan formula RRF dan cara hitungnya
- [ ] Bisa tunjukkan baris kode yang relevan
- [ ] Bisa gambar diagram alur di papan tulis
