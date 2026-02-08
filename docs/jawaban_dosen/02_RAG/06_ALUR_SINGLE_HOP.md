# 🔍 ALUR LENGKAP SINGLE-HOP RAG

## Pertanyaan Dosen
> "Coba jelaskan alur single-hop dari awal (upload PDF) sampai jawaban!"

---

## 🎯 Overview Single-hop

**Single-hop = 2 Fase**
1. **FASE 1: Data Ingestion** - Upload PDF → Store ke database
2. **FASE 2: Query Processing** - Pertanyaan → 1x retrieval → Answer

```
┌─────────────────────────────────────────────────────────────────┐
│                    SINGLE-HOP RAG OVERVIEW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FASE 1: DATA INGESTION (sekali saat upload)                    │
│  PDF → Parse → Chunk → Embed → Store → BM25 Cache               │
│                                                                  │
│  FASE 2: QUERY PROCESSING (setiap user bertanya)                │
│  Question → Embed → Hybrid Search → LLM Generate → Answer       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# 📥 FASE 1: DATA INGESTION

## Alur Ingestion Lengkap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA INGESTION FLOW                                 │
│                          Endpoint: POST /ingest                              │
│                          📍 Baris: 637-705                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Admin: Upload "peraturan_akademik.pdf"                                     │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: PDF UPLOAD                                                  │   │
│  │                                                                       │   │
│  │  const data = await req.file();                                      │   │
│  │  const buffer = await data.toBuffer();                               │   │
│  │                                                                       │   │
│  │  📍 Baris: 649-652                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 2: PDF PARSING (Extract Text)                                  │   │
│  │                                                                       │   │
│  │  const pdfData = await pdfParse(buffer);                             │   │
│  │  const fullText = pdfData.text;  // ~50,000 karakter                │   │
│  │                                                                       │   │
│  │  Library: pdf-parse                                                  │   │
│  │                                                                       │   │
│  │  📍 Baris: 674                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: SMART CHUNKING                                              │   │
│  │                                                                       │   │
│  │  const chunks = chunkText(fullText, 800, 150);                       │   │
│  │                                                                       │   │
│  │  Features:                                                           │   │
│  │  ├── Split per PARAGRAF (bukan per karakter)                        │   │
│  │  ├── Deteksi HEADING (BAB, Pasal, Artikel)                          │   │
│  │  ├── Max 800 karakter per chunk                                     │   │
│  │  └── OVERLAP 150 karakter                                           │   │
│  │                                                                       │   │
│  │  Output: ~60 chunks                                                  │   │
│  │                                                                       │   │
│  │  📍 Baris: 81-156, 676                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 4: EMBEDDING (LLM)                                             │   │
│  │                                                                       │   │
│  │  Untuk SETIAP chunk:                                                 │   │
│  │  const vec = await embedWithOllama(chunks[i]);                       │   │
│  │                                                                       │   │
│  │  Input: "Syarat yudisium adalah lulus semua MK..."                  │   │
│  │  Output: [0.123, -0.456, 0.789, ...] (4096 dimensi)                 │   │
│  │                                                                       │   │
│  │  Model: llama3:8b                                                    │   │
│  │  API: POST http://localhost:11434/api/embeddings                    │   │
│  │                                                                       │   │
│  │  📍 Baris: 158-176, 686-688                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 5: STORE TO QDRANT                                             │   │
│  │                                                                       │   │
│  │  await qdrant.upsert(COLLECTION_NAME, {                              │   │
│  │    points: [                                                         │   │
│  │      {                                                               │   │
│  │        id: 1,                                                        │   │
│  │        vector: [0.123, -0.456, ...],  // 4096 dimensi               │   │
│  │        payload: {                                                    │   │
│  │          source_file: "peraturan_akademik.pdf",                     │   │
│  │          text: "Syarat yudisium adalah..."                          │   │
│  │        }                                                             │   │
│  │      },                                                              │   │
│  │      // ... 59 chunks lainnya                                       │   │
│  │    ]                                                                 │   │
│  │  });                                                                 │   │
│  │                                                                       │   │
│  │  📍 Baris: 691-695                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 6: BUILD BM25 CACHE                                            │   │
│  │                                                                       │   │
│  │  await rebuildKeywordCache();                                        │   │
│  │                                                                       │   │
│  │  Load semua chunks ke RAM + hitung statistik kata (DF, avgdl)       │   │
│  │  untuk keyword search yang cepat                                    │   │
│  │                                                                       │   │
│  │  📍 Baris: 191-243, 697                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ✅ DATA SIAP UNTUK QUERY!                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 🔍 FASE 2: SINGLE-HOP QUERY

## Alur Query Lengkap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SINGLE-HOP QUERY FLOW                                  │
│                       Endpoint: POST /chat                                   │
│                       📍 Baris: 707-816                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User: "Apa syarat yudisium?"                                               │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: EMBEDDING QUERY (LLM)                                       │   │
│  │                                                                       │   │
│  │  const qVec = await embedWithOllama("Apa syarat yudisium?");         │   │
│  │                                                                       │   │
│  │  Input: "Apa syarat yudisium?"                                       │   │
│  │  Output: [0.15, -0.42, 0.81, ...] (4096 dimensi)                    │   │
│  │                                                                       │   │
│  │  📍 Baris: 437                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                   │                                                         │
│         ┌─────────┴─────────┐                                               │
│         │                   │                                               │
│         ▼                   ▼                                               │
│  ┌─────────────────┐ ┌─────────────────┐                                   │
│  │  STEP 2A:       │ │  STEP 2B:       │                                   │
│  │  VECTOR SEARCH  │ │  BM25 SEARCH    │                                   │
│  │                 │ │                 │                                   │
│  │  qdrant.search( │ │  bm25Score(     │                                   │
│  │    vector: qVec │ │    queryTokens, │                                   │
│  │  );             │ │    chunkTokens  │                                   │
│  │                 │ │  );             │                                   │
│  │  Semantic match │ │  Keyword match  │                                   │
│  │                 │ │                 │                                   │
│  │  📍 Baris:      │ │  📍 Baris:      │                                   │
│  │  439-448        │ │  450-467        │                                   │
│  └────────┬────────┘ └────────┬────────┘                                   │
│           │                   │                                             │
│           │  Rank: 1,2,3...   │  Rank: 1,2,3...                            │
│           │                   │                                             │
│           └─────────┬─────────┘                                             │
│                     │                                                        │
│                     ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: RRF FUSION                                                  │   │
│  │                                                                       │   │
│  │  const fused = rrfFuse(vectorRank, keywordRank, k=60);               │   │
│  │                                                                       │   │
│  │  Formula: Score = 1/(60+rank_vector) + 1/(60+rank_bm25)             │   │
│  │                                                                       │   │
│  │  Chunk yang bagus di KEDUA metode → skor tertinggi!                 │   │
│  │                                                                       │   │
│  │  📍 Baris: 311-316, 469                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                     │                                                        │
│                     ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 4: SELECT TOP-8 CHUNKS                                         │   │
│  │                                                                       │   │
│  │  contextChunks = fusedResults.slice(0, 8);                           │   │
│  │                                                                       │   │
│  │  📍 Baris: 721                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                     │                                                        │
│                     ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 5: BUILD CONTEXT + PROMPT                                      │   │
│  │                                                                       │   │
│  │  // Format context dengan nomor sitasi                               │   │
│  │  contextText = "[#1]\nSyarat yudisium adalah...\n\n---\n\n"         │   │
│  │               + "[#2]\nIPK minimal 2.00...\n\n---\n\n" + ...        │   │
│  │                                                                       │   │
│  │  // System prompt (anti-halusinasi)                                  │   │
│  │  system = "Jawab HANYA dari CONTEXT. Pakai sitasi [#N]."            │   │
│  │                                                                       │   │
│  │  📍 Baris: 723-764                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                     │                                                        │
│                     ▼                                                        │   
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 6: LLM GENERATE ANSWER                                         │   │
│  │                                                                       │   │
│  │  const chat = await ollamaChat([                                     │   │
│  │    { role: "system", content: system },                              │   │
│  │    { role: "user", content: userPrompt }                             │   │
│  │  ], temperature=0.2);                                                │   │
│  │                                                                       │   │
│  │  Model: llama3:8b                                                    │   │
│  │  📍 Baris: 768-780                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                     │                                                        │
│                     ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 7: VALIDATE + RETRY (Anti-Halusinasi)                          │   │
│  │                                                                       │   │
│  │  if (!hasCitations(answer)) {                                        │   │
│  │    answer = await retry(answer);  // Minta LLM tambah sitasi        │   │
│  │  }                                                                   │   │
│  │  if (!hasCitations(answer)) {                                        │   │
│  │    answer = ensureCitationsInText(answer);  // Paksa tambah         │   │
│  │  }                                                                   │   │
│  │                                                                       │   │
│  │  📍 Baris: 782-807                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                     │                                                        │
│                     ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 8: RETURN RESPONSE                                             │   │
│  │                                                                       │   │
│  │  return {                                                            │   │
│  │    reply: "Syarat yudisium meliputi:\n"                             │   │
│  │         + "1. Lulus semua MK wajib [#1]\n"                          │   │
│  │         + "2. IPK minimal 2.00 [#2]",                               │   │
│  │    chunks: contextChunks                                            │   │
│  │  };                                                                  │   │
│  │                                                                       │   │
│  │  📍 Baris: 809-815                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 📝 CONTOH LENGKAP: Step-by-Step dengan Data Aktual

## Input Pertanyaan

```
User: "Apa syarat yudisium?"
```

---

## STEP 1: Embedding Query

**📍 Baris: 437**

**Apa yang terjadi:**
Query user diubah menjadi vektor 4096 dimensi menggunakan LLM.

```javascript
const qVec = await embedWithOllama("Apa syarat yudisium?");

// Output:
qVec = [0.15, -0.42, 0.81, 0.23, -0.56, ...] // 4096 angka
```

**Kenapa perlu embedding?**
- Qdrant menyimpan data sebagai vektor
- Untuk mencari chunk yang "mirip", kita perlu membandingkan vektor
- Vektor merepresentasikan "makna" dari teks

---

## STEP 2A: Vector Search

**📍 Baris: 439-448**

**Apa yang terjadi:**
Qdrant mencari chunk yang vektornya paling mirip dengan vektor query (menggunakan Cosine Similarity).

```javascript
const vectorHits = await qdrant.search(COLLECTION_NAME, {
  vector: qVec,        // Vektor dari pertanyaan
  limit: 12,           // Ambil 12 hasil
  with_payload: true,  // Sertakan teks
});
```

**Hasil Vector Search:**

```javascript
vectorHits = [
  { id: "chunk_45", score: 0.91, payload: { text: "Syarat yudisium adalah mahasiswa harus menyelesaikan semua mata kuliah wajib..." } },
  { id: "chunk_12", score: 0.87, payload: { text: "Untuk mengikuti yudisium, IPK minimal adalah 2.00..." } },
  { id: "chunk_78", score: 0.82, payload: { text: "Mahasiswa yang akan yudisium harus bebas dari nilai E..." } },
  { id: "chunk_33", score: 0.79, payload: { text: "Syarat administratif yudisium meliputi pelunasan biaya..." } },
  { id: "chunk_99", score: 0.75, payload: { text: "Skripsi harus sudah disetujui sebelum yudisium..." } },
  // ... 7 chunk lainnya
];

// Buat ranking
vectorRank = new Map([
  ["chunk_45", 1],  // Rank 1
  ["chunk_12", 2],  // Rank 2
  ["chunk_78", 3],  // Rank 3
  ["chunk_33", 4],  // Rank 4
  ["chunk_99", 5],  // Rank 5
  // ...
]);
```

---

## STEP 2B: BM25 Search (Parallel dengan Vector Search)

**📍 Baris: 450-467**

**Apa yang terjadi:**
Cari chunk yang mengandung kata kunci dari query menggunakan algoritma BM25.

```javascript
// 1. Tokenize query
const qToks = filterStopwords(tokenize("Apa syarat yudisium?"));
// Output: ["syarat", "yudisium"]  ("apa" dihapus karena stopword)

// 2. Hitung skor BM25 untuk setiap chunk
const bm25Scored = keywordCache.points.map((p) => {
  const docToks = filterStopwords(tokenize(p.payload.text));
  return { 
    id: p.id, 
    score: bm25Score(qToks, docToks, df, avgdl),
    payload: p.payload 
  };
})
.filter(x => x.score > 0)
.sort((a, b) => b.score - a.score)
.slice(0, 12);
```

**Hasil BM25 Search:**

```javascript
bm25Scored = [
  { id: "chunk_45", score: 8.5, payload: { text: "Syarat yudisium adalah..." } },
  { id: "chunk_33", score: 7.2, payload: { text: "Syarat administratif yudisium..." } },
  { id: "chunk_12", score: 6.8, payload: { text: "Untuk mengikuti yudisium..." } },
  { id: "chunk_22", score: 5.9, payload: { text: "Persyaratan yudisium harus..." } },
  { id: "chunk_78", score: 5.1, payload: { text: "Mahasiswa yang akan yudisium..." } },
  // ...
];

// Buat ranking
keywordRank = new Map([
  ["chunk_45", 1],  // Rank 1
  ["chunk_33", 2],  // Rank 2
  ["chunk_12", 3],  // Rank 3
  ["chunk_22", 4],  // Rank 4
  ["chunk_78", 5],  // Rank 5
  // ...
]);
```

---

## STEP 3: RRF Fusion

**📍 Baris: 311-316, 469**

**Apa yang terjadi:**
Gabungkan kedua ranking dengan formula Reciprocal Rank Fusion.

```javascript
const fused = rrfFuse(vectorRank, keywordRank, k = 60);

// Formula: Score(d) = 1/(60 + rank_vector) + 1/(60 + rank_bm25)
```

**Perhitungan Manual:**

```
┌──────────┬─────────────┬────────────┬───────────────────────────────────  ┌───────────┐
│  Chunk   │ Rank Vector │ Rank BM25  │           Perhitungan               │ RRF Score │
├──────────┼─────────────┼────────────┼───────────────────────────────────  ┼───────────┤
│ chunk_45 │      1      │     1      │ 1/(60+1) + 1/(60+1) = 0.0164*2      │  0.0328   │ ← TERTINGGI!
│ chunk_12 │      2      │     3      │ 1/(60+2) + 1/(60+3) = 0.0161+0.0159 │  0.0320   │
│ chunk_33 │      4      │     2      │ 1/(60+4) + 1/(60+2) = 0.0156+0.0161 │  0.0317   │
│ chunk_78 │      3      │     5      │ 1/(60+3) + 1/(60+5) = 0.0159+0.0154 │  0.0313   │ 
│ chunk_22 │     10      │     4      │ 1/(60+10) + 1/(60+4) = 0.0143+0.0156│ 0.0299    │
│ chunk_99 │      5      │    12      │ 1/(60+5) + 1/(60+12) = 0.0154+0.0139│ 0.0293    │
└──────────┴─────────────┴────────────┴───────────────────────────────────  ┴───────────┘
```

**Insight:**
- chunk_45 rank 1 di KEDUA metode → skor tertinggi!
- chunk_22 rank 10 di Vector tapi rank 4 di BM25 → naik ke rank 5

---

## STEP 4: Select Top-8 Chunks

**📍 Baris: 721**

**Apa yang terjadi:**
Ambil 8 chunk dengan RRF score tertinggi.

```javascript
const contextChunks = fusedSorted.slice(0, 8);

contextChunks = [
  { id: "chunk_45", score: 0.0328, text: "Syarat yudisium adalah mahasiswa harus menyelesaikan semua mata kuliah wajib dan pilihan sesuai kurikulum yang berlaku." },
  { id: "chunk_12", score: 0.0320, text: "Untuk mengikuti yudisium, IPK minimal adalah 2.00. Mahasiswa dengan IPK di bawah batas tidak dapat yudisium." },
  { id: "chunk_33", score: 0.0317, text: "Syarat administratif yudisium meliputi pelunasan biaya kuliah dan tidak memiliki tunggakan perpustakaan." },
  { id: "chunk_78", score: 0.0313, text: "Mahasiswa yang akan yudisium harus bebas dari nilai E pada mata kuliah wajib." },
  { id: "chunk_22", score: 0.0299, text: "Persyaratan yudisium harus sudah lengkap 2 minggu sebelum jadwal yudisium." },
  { id: "chunk_99", score: 0.0293, text: "Skripsi harus sudah disetujui dan di-upload ke repository sebelum yudisium." },
  { id: "chunk_55", score: 0.0285, text: "Masa studi maksimal untuk dapat yudisium adalah 7 tahun (14 semester)." },
  { id: "chunk_67", score: 0.0278, text: "Mahasiswa harus mengisi form pendaftaran yudisium di portal akademik." },
];
```

---

## STEP 5: Build Context + Prompt

**📍 Baris: 723-764**

**Apa yang terjadi:**
Format chunks menjadi context string dengan nomor sitasi, lalu buat prompt untuk LLM.

```javascript
// 1. Format context dengan sitasi
const contextText = contextChunks
  .map((c, idx) => `[#${idx + 1}]\n${c.text}`)
  .join("\n\n---\n\n");
```

**Output Context:**

```
[#1]
Syarat yudisium adalah mahasiswa harus menyelesaikan semua mata kuliah wajib dan pilihan sesuai kurikulum yang berlaku.

---

[#2]
Untuk mengikuti yudisium, IPK minimal adalah 2.00. Mahasiswa dengan IPK di bawah batas tidak dapat yudisium.

---

[#3]
Syarat administratif yudisium meliputi pelunasan biaya kuliah dan tidak memiliki tunggakan perpustakaan.

---

[#4]
Mahasiswa yang akan yudisium harus bebas dari nilai E pada mata kuliah wajib.

---

[#5]
Persyaratan yudisium harus sudah lengkap 2 minggu sebelum jadwal yudisium.

---

[#6]
Skripsi harus sudah disetujui dan di-upload ke repository sebelum yudisium.

---

[#7]
Masa studi maksimal untuk dapat yudisium adalah 7 tahun (14 semester).

---

[#8]
Mahasiswa harus mengisi form pendaftaran yudisium di portal akademik.
```

**System Prompt (Anti-Halusinasi):**

```javascript
const system = `Kamu adalah asisten kampus berbasis dokumen.

ATURAN KONTEN:
- Jawaban HANYA berdasarkan CONTEXT yang diberikan.
- Jika tidak ada bukti di CONTEXT, tulis: "Tidak ditemukan di dokumen."
- WAJIB cantumkan sitasi [#N] di setiap klaim.`;

const userPrompt = `PERTANYAAN:\nApa syarat yudisium?\n\nCONTEXT:\n${contextText}`;
```

---

## STEP 6: LLM Generate Answer

**📍 Baris: 768-780**

**Apa yang terjadi:**
LLM (llama3:8b) menerima prompt dan generate jawaban berdasarkan context.

```javascript
const chat = await ollamaChat([
  { role: "system", content: system },
  { role: "user", content: userPrompt }
], temperature = 0.2);

const answer = chat.message.content;
```

**Output LLM:**

```
Syarat yudisium meliputi:

**Akademik:**
1. Menyelesaikan semua mata kuliah wajib dan pilihan sesuai kurikulum [#1]
2. IPK minimal 2.00 [#2]
3. Bebas dari nilai E pada mata kuliah wajib [#4]
4. Skripsi sudah disetujui dan di-upload ke repository [#6]
5. Masa studi tidak melebihi 7 tahun (14 semester) [#7]

**Administratif:**
1. Pelunasan biaya kuliah [#3]
2. Tidak ada tunggakan perpustakaan [#3]
3. Mengisi form pendaftaran yudisium di portal akademik [#8]
4. Semua persyaratan lengkap 2 minggu sebelum jadwal yudisium [#5]
```

---

## STEP 7: Validate + Retry

**📍 Baris: 782-807**

**Apa yang terjadi:**
Sistem memeriksa apakah jawaban memiliki sitasi [#N]. Jika tidak, retry atau fallback.

```javascript
// Cek sitasi
if (!hasCitations(answer) && !isNotFoundText(answer)) {
  // Retry: minta LLM tambahkan sitasi
  const repairMessages = [
    { role: "system", content: "Tambahkan sitasi [#N] ke jawaban." },
    { role: "user", content: `Jawaban: ${answer}\n\nTambahkan sitasi!` }
  ];
  const chat2 = await ollamaChat(repairMessages, 0.0);
  answer = chat2.message.content;
}

// Fallback: paksa tambah sitasi jika masih tidak ada
if (!hasCitations(answer)) {
  answer = ensureCitationsInText(answer, "[#1]");
}
```

**Dalam contoh ini:** Jawaban sudah punya sitasi ✅, jadi tidak perlu retry.

---

## STEP 8: Return Response

**📍 Baris: 809-815**

**Apa yang terjadi:**
Kirim response ke frontend dengan jawaban dan chunk (untuk transparansi).

```javascript
return {
  reply: answer,
  chunks: contextChunks.map(c => ({
    text: c.text,
    source_file: c.source_file,
    chunk_index: c.chunk_index
  }))
};
```

**Response JSON ke Frontend:**

```json
{
  "reply": "Syarat yudisium meliputi:\n\n**Akademik:**\n1. Menyelesaikan semua mata kuliah... [#1]\n...",
  "chunks": [
    { "text": "Syarat yudisium adalah...", "source_file": "peraturan_akademik.pdf", "chunk_index": 45 },
    { "text": "Untuk mengikuti yudisium...", "source_file": "peraturan_akademik.pdf", "chunk_index": 12 },
    // ... 6 chunk lainnya
  ]
}
```

---

## 📊 Timeline Eksekusi

```
FASE 1: INGESTION (~30-60 detik per PDF, sekali saja)
├── PDF Parse: ~500ms
├── Chunking: ~100ms
├── Embedding 60 chunks: ~30 detik
├── Store to Qdrant: ~1 detik
└── Build BM25 Cache: ~500ms

FASE 2: QUERY (~2 detik per pertanyaan)
0ms      100ms    200ms    500ms         2000ms       2200ms
│         │        │        │              │            │
▼         ▼        ▼        ▼              ▼            ▼
┌─────────┬────────┬────────┬──────────────┬────────────┐
│  Embed  │ Vector │  BM25  │     LLM      │  Validate  │
│  Query  │ Search │ + RRF  │   Generate   │  + Return  │
│         │        │        │              │            │
│  ~100ms │ ~50ms  │ ~50ms  │   ~1500ms    │   ~200ms   │
└─────────┴────────┴────────┴──────────────┴────────────┘
```

---

## 📍 Referensi Baris Kode

### FASE 1: Ingestion

| Step | Fungsi | Baris |
|------|--------|-------|
| 1 | PDF upload | 649-652 |
| 2 | PDF parse | 674 |
| 3 | Chunking | 81-156, 676 |
| 4 | Embedding | 158-176, 686-688 |
| 5 | Store Qdrant | 691-695 |
| 6 | BM25 Cache | 191-243, 697 |

### FASE 2: Query

| Step | Fungsi | Baris |
|------|--------|-------|
| 1 | Embed query | 437 |
| 2a | Vector search | 439-448 |
| 2b | BM25 search | 450-467 |
| 3 | RRF fusion | 311-316, 469 |
| 4 | Select top-K | 721 |
| 5 | Build prompt | 723-764 |
| 6 | LLM generate | 768-780 |
| 7 | Validate | 782-807 |
| 8 | Return | 809-815 |

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, alur Single-hop ada 2 fase:"**

### **FASE 1: Ingestion** (sekali saat upload)
1. **"Admin upload PDF"** → endpoint `/ingest`
2. **"Parse PDF"** → extract teks dengan pdf-parse
3. **"Smart Chunking"** → potong per paragraf, max 800 char
4. **"Embedding"** → LLM ubah teks jadi vektor 4096 dimensi
5. **"Store ke Qdrant"** → simpan vektor + teks
6. **"Build BM25 Cache"** → load ke RAM untuk keyword search

### **FASE 2: Query** (setiap user bertanya)
1. **"Embed pertanyaan"** → jadi vektor
2. **"Hybrid Search"** → Vector + BM25 + RRF
3. **"Ambil 8 chunk terbaik"**
4. **"LLM generate jawaban"** → dengan sitasi [#N]
5. **"Validate"** → pastikan ada sitasi
6. **"Return"** → kirim ke user

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan FASE 1 (6 step ingestion)
- [ ] Bisa jelaskan FASE 2 (8 step query)
- [ ] Bisa jelaskan hybrid search (vector + BM25 + RRF)
- [ ] Bisa jelaskan anti-halusinasi
- [ ] Bisa tunjukkan baris kode setiap step
