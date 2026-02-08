# 🔀 ALUR LENGKAP MULTI-HOP RAG

## Pertanyaan Dosen
> "Coba jelaskan alur multi-hop dari awal (upload PDF) sampai jawaban!"

---

## 🎯 Overview Multi-hop

**Multi-hop = 2 Fase**
1. **FASE 1: Data Ingestion** - Upload PDF → Store ke database (SAMA dengan Single-hop)
2. **FASE 2: Query Processing** - Pecah pertanyaan → 4x retrieval → Gabung → Answer

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-HOP RAG OVERVIEW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FASE 1: DATA INGESTION (sekali saat upload)                    │
│  PDF → Parse → Chunk → Embed → Store → BM25 Cache               │
│  (SAMA dengan Single-hop)                                        │
│                                                                  │
│  FASE 2: QUERY PROCESSING (setiap user bertanya)                │
│  Question → LLM Decompose → 4x Hybrid Search → Merge            │
│           → LLM Synthesize → Answer                              │
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
│                                                                              │
│                          ⚠ SAMA DENGAN SINGLE-HOP                           │
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
│  │  Model: llama3:8b                                                    │   │
│  │  Output: vektor 4096 dimensi                                         │   │
│  │                                                                       │   │
│  │  📍 Baris: 158-176, 686-688                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 5: STORE TO QDRANT                                             │   │
│  │                                                                       │   │
│  │  await qdrant.upsert(COLLECTION_NAME, { points });                   │   │
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
│  │  📍 Baris: 191-243, 697                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ✅ DATA SIAP UNTUK QUERY!                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 🔀 FASE 2: MULTI-HOP QUERY

## Alur Query Lengkap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-HOP QUERY FLOW                                 │
│                         Endpoint: POST /chat-multihop                        │
│                         📍 Baris: 823-956                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User: "Jelaskan proses yudisium lengkap dari syarat sampai wisuda"         │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: QUERY DECOMPOSITION (LLM #1)                                │   │
│  │                                                                       │   │
│  │  ⭐ INI YANG MEMBEDAKAN MULTI-HOP!                                   │   │
│  │                                                                       │   │
│  │  const subQueries = await decomposeQuery(question);                  │   │
│  │                                                                       │   │
│  │  LLM menerima prompt:                                                │   │
│  │  "Pecah pertanyaan ini jadi 4 sub-query:                            │   │
│  │   1) overview/definisi                                               │   │
│  │   2) detail/poin utama                                               │   │
│  │   3) aturan/batasan                                                  │   │
│  │   4) penutup/tindak lanjut"                                         │   │
│  │                                                                       │   │
│  │  Output JSON:                                                        │   │
│  │  {                                                                   │   │
│  │    "overview": "Apa definisi yudisium?",                            │   │
│  │    "detail": "Apa syarat lengkap yudisium?",                        │   │
│  │    "aturan": "Apa batasan dalam yudisium?",                         │   │
│  │    "penutup": "Apa yang terjadi setelah yudisium?"                  │   │
│  │  }                                                                   │   │
│  │                                                                       │   │
│  │  📍 Baris: 491-543, 831                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│    ┌───────────────┼───────────────┬───────────────┬───────────────┐        │
│    │               │               │               │               │        │
│    ▼               ▼               ▼               ▼               │        │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   PARALLEL! │        │
│  │OVERVIEW │   │ DETAIL  │   │ ATURAN  │   │ PENUTUP │            │        │
│  │         │   │         │   │         │   │         │            │        │
│  │ Hybrid  │   │ Hybrid  │   │ Hybrid  │   │ Hybrid  │            │        │
│  │ Search  │   │ Search  │   │ Search  │   │ Search  │            │        │
│  │         │   │         │   │         │   │         │            │        │
│  │ 4 chunk │   │ 4 chunk │   │ 4 chunk │   │ 4 chunk │            │        │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘            │        │
│       │             │             │             │                  │        │
│  ┌────────────────────────────────────────────────────────────────┘        │
│  │  STEP 2: PARALLEL RETRIEVAL (4x Hybrid Search)                          │
│  │                                                                          │
│  │  const [overview, detail, aturan, penutup] = await Promise.all([        │
│  │    hybridRetrieve(subQueries.overview, 4),   // 4 chunks                │
│  │    hybridRetrieve(subQueries.detail, 4),     // 4 chunks                │
│  │    hybridRetrieve(subQueries.aturan, 4),     // 4 chunks                │
│  │    hybridRetrieve(subQueries.penutup, 4),    // 4 chunks                │
│  │  ]);                                                                     │
│  │                                                                          │
│  │  Total: 4 × 4 = 16 chunks                                               │
│  │  Waktu: ~500ms (parallel, bukan 4 × 500ms sequential)                   │
│  │                                                                          │
│  │  📍 Baris: 834-839                                                       │
│  └──────────────────────────────────────────────────────────────────────────│
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: MERGE + DEDUPLICATE                                         │   │
│  │                                                                       │   │
│  │  // Gabungkan semua chunks dengan label hop-nya                      │   │
│  │  let allChunks = [                                                   │   │
│  │    ...overview.map(c => ({...c, hop: "overview"})),                 │   │
│  │    ...detail.map(c => ({...c, hop: "detail"})),                     │   │
│  │    ...aturan.map(c => ({...c, hop: "aturan"})),                     │   │
│  │    ...penutup.map(c => ({...c, hop: "penutup"})),                   │   │
│  │  ];                                                                  │   │
│  │                                                                       │   │
│  │  // Deduplicate: hapus chunk yang sama                               │   │
│  │  const seen = new Set();                                             │   │
│  │  allChunks = allChunks.filter(c => !seen.has(c.id));                │   │
│  │                                                                       │   │
│  │  Hasil: 16 → ~10-12 unique chunks                                   │   │
│  │                                                                       │   │
│  │  📍 Baris: 841-862                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 4: BUILD CONTEXT WITH HOP LABELS                               │   │
│  │                                                                       │   │
│  │  contextText = allChunks                                             │   │
│  │    .map((c, idx) => `[#${idx + 1}] (${c.hop})\n${c.text}`)          │   │
│  │    .join("\n\n---\n\n");                                            │   │
│  │                                                                       │   │
│  │  Contoh:                                                             │   │
│  │  "[#1] (overview) Yudisium adalah sidang..."                        │   │
│  │  "[#2] (detail) Syarat yudisium meliputi..."                        │   │
│  │  "[#3] (aturan) Tidak boleh ada nilai E..."                         │   │
│  │  "[#4] (penutup) Setelah yudisium, daftar wisuda..."                │   │
│  │                                                                       │   │
│  │  📍 Baris: 873-875                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 5: LLM SYNTHESIS (LLM #2)                                      │   │
│  │                                                                       │   │
│  │  const chat = await ollamaChat([                                     │   │
│  │    { role: "system", content: system },                              │   │
│  │    { role: "user", content: userPrompt }                             │   │
│  │  ], temperature=0.2);                                                │   │
│  │                                                                       │   │
│  │  LLM menerima:                                                       │   │
│  │  - Context dari 4 aspek (overview, detail, aturan, penutup)         │   │
│  │  - Original question                                                 │   │
│  │                                                                       │   │
│  │  LLM menghasilkan jawaban KOMPREHENSIF dengan sitasi [#N]           │   │
│  │                                                                       │   │
│  │  📍 Baris: 907-920                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 6: VALIDATE + RETURN                                           │   │
│  │                                                                       │   │
│  │  // Validate sitasi (sama seperti single-hop)                        │   │
│  │                                                                       │   │
│  │  return {                                                            │   │
│  │    reply: "Proses yudisium meliputi:\n\n"                           │   │
│  │         + "**Definisi:** Yudisium adalah... [#1]\n"                 │   │
│  │         + "**Syarat:** Lulus semua MK... [#2]\n"                    │   │
│  │         + "**Aturan:** Tidak boleh nilai E... [#3]\n"               │   │
│  │         + "**Setelah:** Daftar wisuda... [#4]",                     │   │
│  │    chunks: allChunks,                                               │   │
│  │    subQueries: subQueries                                           │   │
│  │  };                                                                  │   │
│  │                                                                       │   │
│  │  📍 Baris: 944-955                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 📝 CONTOH LENGKAP: Step-by-Step dengan Data Aktual

## Input Pertanyaan

```
User: "Jelaskan proses yudisium lengkap dari syarat sampai wisuda"
```

---

## STEP 1: Query Decomposition

**📍 Baris: 491-543**

**Apa yang terjadi:**
LLM menerima pertanyaan dan memecahnya menjadi 4 sub-pertanyaan spesifik.

```javascript
// Input ke LLM
const prompt = `Pecah pertanyaan ini jadi 4 sub-query:
1) overview/definisi
2) detail/poin utama
3) aturan/batasan
4) penutup/tindak lanjut

Pertanyaan: "${question}"`;

// LLM memproses dan return JSON:
{
  "overview": "Apa definisi dan pengertian yudisium?",
  "detail": "Apa syarat-syarat lengkap untuk mengikuti yudisium?",
  "aturan": "Apa batasan dan larangan dalam proses yudisium?",
  "penutup": "Apa langkah setelah yudisium sampai wisuda?"
}
```

**Kenapa 4 sub-query?**
- **overview**: Dapat konteks definisi
- **detail**: Dapat syarat-syarat
- **aturan**: Dapat larangan/batasan
- **penutup**: Dapat info tindak lanjut

---

## STEP 2: Parallel Retrieval (4x Hybrid Search)

**📍 Baris: 834-839**

**Apa yang terjadi:**
Setiap sub-query diproses dengan Hybrid Search (Vector + BM25 + RRF) secara BERSAMAAN.

```javascript
const [overview, detail, aturan, penutup] = await Promise.all([
  hybridRetrieve("Apa definisi yudisium?", 4),
  hybridRetrieve("Apa syarat-syarat lengkap yudisium?", 4),
  hybridRetrieve("Apa batasan dan larangan yudisium?", 4),
  hybridRetrieve("Apa langkah setelah yudisium?", 4),
]);
```

### Detail Sub-query 1: "Apa definisi yudisium?"

```
┌───────────────────────────────────────────────────────────────────┐
│  HYBRID SEARCH untuk "Apa definisi yudisium?"                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. EMBEDDING (baris 437)                                         │
│     Text: "Apa definisi yudisium?"                                │
│     → Vektor: [0.12, -0.34, 0.56, ...] (4096 dimensi)            │
│                                                                    │
│  2. VECTOR SEARCH (baris 439-448)                                 │
│     Query Qdrant dengan vektor tersebut                           │
│     Hasil (by cosine similarity):                                 │
│     ├── chunk_12: 0.91 - "Yudisium adalah sidang penetapan..."   │
│     ├── chunk_45: 0.87 - "Pengertian yudisium menurut..."        │
│     ├── chunk_78: 0.82 - "Definisi yudisium dalam..."            │
│     └── chunk_33: 0.79 - "Sidang yudisium merupakan..."          │
│                                                                    │
│  3. BM25 SEARCH (baris 450-467)                                   │
│     Tokenize: ["definisi", "yudisium"]                            │
│     Cari keyword match di semua chunks                            │
│     Hasil (by BM25 score):                                        │
│     ├── chunk_45: 6.5 - "Pengertian yudisium menurut..."         │
│     ├── chunk_12: 5.2 - "Yudisium adalah sidang..."              │
│     ├── chunk_22: 4.9 - "Yudisium didefinisikan sebagai..."      │
│     └── chunk_78: 4.1 - "Definisi yudisium dalam..."             │
│                                                                    │
│  4. RRF FUSION (baris 469)                                        │
│     Gabungkan ranking dengan formula: 1/(60 + rank)               │
│                                                                    │
│     chunk_12: 1/(60+1) + 1/(60+2) = 0.0164 + 0.0161 = 0.0325    │
│     chunk_45: 1/(60+2) + 1/(60+1) = 0.0161 + 0.0164 = 0.0325    │
│     chunk_78: 1/(60+3) + 1/(60+4) = 0.0159 + 0.0156 = 0.0315    │
│     chunk_22: 0 + 1/(60+3) = 0.0159                              │
│                                                                    │
│  5. OUTPUT: Top 4 chunks                                          │
│     [                                                              │
│       {id:"chunk_12", text:"Yudisium adalah sidang...", score:0.0325},│
│       {id:"chunk_45", text:"Pengertian yudisium...", score:0.0325},│
│       {id:"chunk_78", text:"Definisi yudisium...", score:0.0315}, │
│       {id:"chunk_22", text:"Yudisium didefinisikan...", score:0.0159}│
│     ]                                                              │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### Hasil 4x Parallel Retrieval:

```javascript
// Sub-query 1: overview → 4 chunks
overview = [
  { id: "chunk_12", text: "Yudisium adalah sidang penetapan kelulusan mahasiswa yang diselenggarakan oleh fakultas setiap akhir semester." },
  { id: "chunk_45", text: "Pengertian yudisium menurut Peraturan Rektor No. 5/2024 adalah proses verifikasi akhir status akademik mahasiswa." },
  { id: "chunk_78", text: "Definisi yudisium dalam peraturan akademik adalah sidang pengesahan kelulusan." },
  { id: "chunk_22", text: "Yudisium didefinisikan sebagai tahap akhir sebelum wisuda." },
];

// Sub-query 2: detail → 4 chunks
detail = [
  { id: "chunk_101", text: "Syarat yudisium: (1) Lulus semua mata kuliah wajib, (2) Total SKS minimal 144, (3) IPK minimal 2.00." },
  { id: "chunk_102", text: "Mahasiswa harus menyelesaikan skripsi dan lulus ujian sidang." },
  { id: "chunk_103", text: "Tidak memiliki tunggakan administrasi atau keuangan." },
  { id: "chunk_104", text: "Sudah mengunggah laporan akhir di repository kampus." },
];

// Sub-query 3: aturan → 4 chunks
aturan = [
  { id: "chunk_201", text: "Mahasiswa dengan nilai E pada mata kuliah wajib tidak dapat mengikuti yudisium." },
  { id: "chunk_202", text: "Batas maksimal masa studi adalah 7 tahun (14 semester)." },
  { id: "chunk_101", text: "Syarat yudisium: (1) Lulus semua MK..." },  // DUPLIKAT!
  { id: "chunk_204", text: "IPK di bawah 2.00 akan ditolak otomatis oleh sistem." },
];

// Sub-query 4: penutup → 4 chunks
penutup = [
  { id: "chunk_301", text: "Setelah yudisium, mahasiswa mendapat SK Lulus dalam 3 hari kerja." },
  { id: "chunk_302", text: "Pendaftaran wisuda dibuka 2 minggu setelah yudisium." },
  { id: "chunk_303", text: "Syarat wisuda: foto formal, pembayaran toga, konfirmasi kehadiran." },
  { id: "chunk_304", text: "Wisuda dilaksanakan 1 bulan setelah pendaftaran ditutup." },
];

// Total: 16 chunks (dengan beberapa duplikat)
```

---

## STEP 3: Merge + Deduplicate

**📍 Baris: 841-862**

**Apa yang terjadi:**
Gabungkan semua chunks dan tandai dengan label hop-nya (overview/detail/aturan/penutup), lalu hapus duplikat.

```javascript
// 1. Gabungkan dengan label
let allChunks = [
  { id: "chunk_12", text: "Yudisium adalah...", hop: "overview" },
  { id: "chunk_45", text: "Pengertian yudisium...", hop: "overview" },
  // ... (lebih banyak)
  { id: "chunk_101", text: "Syarat yudisium...", hop: "detail" },
  { id: "chunk_101", text: "Syarat yudisium...", hop: "aturan" },  // DUPLIKAT!
  // ...
];
// Total: 16 chunks

// 2. Deduplicate berdasarkan ID
const seen = new Set();
allChunks = allChunks.filter(c => {
  if (seen.has(c.id)) return false;  // Skip duplikat
  seen.add(c.id);
  return true;
});

// Hasil akhir: 14 unique chunks
```

---

## STEP 4: Build Context with Labels

**📍 Baris: 873-875**

**Apa yang terjadi:**
Format chunks menjadi string context dengan nomor sitasi dan label hop.

```javascript
contextText = allChunks
  .map((c, idx) => `[#${idx + 1}] (${c.hop})\n${c.text}`)
  .join("\n\n---\n\n");
```

**Output Context:**

```
[#1] (overview)
Yudisium adalah sidang penetapan kelulusan mahasiswa yang diselenggarakan oleh fakultas setiap akhir semester.

---

[#2] (overview)
Pengertian yudisium menurut Peraturan Rektor No. 5/2024 adalah proses verifikasi akhir status akademik mahasiswa.

---

[#3] (overview)
Definisi yudisium dalam peraturan akademik adalah sidang pengesahan kelulusan.

---

[#4] (overview)
Yudisium didefinisikan sebagai tahap akhir sebelum wisuda.

---

[#5] (detail)
Syarat yudisium: (1) Lulus semua mata kuliah wajib, (2) Total SKS minimal 144, (3) IPK minimal 2.00.

---

[#6] (detail)
Mahasiswa harus menyelesaikan skripsi dan lulus ujian sidang.

---

[#7] (detail)
Tidak memiliki tunggakan administrasi atau keuangan.

---

[#8] (detail)
Sudah mengunggah laporan akhir di repository kampus.

---

[#9] (aturan)
Mahasiswa dengan nilai E pada mata kuliah wajib tidak dapat mengikuti yudisium.

---

[#10] (aturan)
Batas maksimal masa studi adalah 7 tahun (14 semester).

---

[#11] (aturan)
IPK di bawah 2.00 akan ditolak otomatis oleh sistem.

---

[#12] (penutup)
Setelah yudisium, mahasiswa mendapat SK Lulus dalam 3 hari kerja.

---

[#13] (penutup)
Pendaftaran wisuda dibuka 2 minggu setelah yudisium.

---

[#14] (penutup)
Wisuda dilaksanakan 1 bulan setelah pendaftaran ditutup.
```

---

## STEP 5: LLM Synthesis

**📍 Baris: 907-920**

**Apa yang terjadi:**
LLM menerima context dari 4 aspek dan menyintesis jawaban komprehensif.

```javascript
const system = `Kamu adalah asisten kampus berbasis dokumen.
ATURAN: Jawab HANYA dari CONTEXT. Pakai sitasi [#N].`;

const userPrompt = `PERTANYAAN:
Jelaskan proses yudisium lengkap dari syarat sampai wisuda

CONTEXT:
${contextText}`;

const chat = await ollamaChat([
  { role: "system", content: system },
  { role: "user", content: userPrompt }
], temperature = 0.2);
```

**Output LLM:**

```
Proses yudisium lengkap dari syarat sampai wisuda adalah sebagai berikut:

**Definisi Yudisium:**
Yudisium adalah sidang penetapan kelulusan mahasiswa yang diselenggarakan fakultas setiap akhir semester [#1]. Menurut Peraturan Rektor No. 5/2024, ini adalah proses verifikasi akhir status akademik [#2].

**Syarat Yudisium:**
1. Lulus semua mata kuliah wajib [#5]
2. Total SKS minimal 144 [#5]
3. IPK minimal 2.00 [#5]
4. Menyelesaikan skripsi dan lulus sidang [#6]
5. Tidak ada tunggakan administrasi [#7]
6. Sudah upload laporan akhir [#8]

**Larangan:**
- Tidak boleh ada nilai E pada MK wajib [#9]
- Masa studi maksimal 7 tahun [#10]
- IPK di bawah 2.00 ditolak otomatis [#11]

**Setelah Yudisium:**
1. SK Lulus diterbitkan dalam 3 hari kerja [#12]
2. Pendaftaran wisuda dibuka 2 minggu kemudian [#13]
3. Wisuda dilaksanakan 1 bulan setelah pendaftaran ditutup [#14]
```

---

## STEP 6: Validate + Return

**📍 Baris: 944-955**

**Apa yang terjadi:**
Sistem memvalidasi jawaban (pastikan ada sitasi) dan mengembalikan response.

```javascript
// Validasi sitasi
if (!hasCitations(answer) && !isNotFoundText(answer)) {
  // Retry dengan LLM
}

// Return response ke frontend
return {
  reply: answer,
  chunks: allChunks,
  subQueries: subQueries
};
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

FASE 2: MULTI-HOP QUERY (~4-5 detik per pertanyaan)
0ms      500ms       1000ms      1500ms                3500ms        4000ms
│         │           │           │                      │             │
▼         ▼           ▼           ▼                      ▼             ▼
┌─────────┬───────────────────────┬──────────────────────┬─────────────┐
│Decompose│  4x Hybrid Search     │        LLM           │  Validate   │
│ (LLM)   │   (PARALLEL)          │      Synthesize      │  + Return   │
│         │                       │                      │             │
│ ~500ms  │       ~500ms          │      ~2000ms         │   ~200ms    │
└─────────┴───────────────────────┴──────────────────────┴─────────────┘
```

---

## 🔄 Perbandingan Single-hop vs Multi-hop

| Aspek | Single-hop | Multi-hop |
|-------|------------|-----------|
| **FASE 1** | SAMA | SAMA |
| **FASE 2 - Decompose** | ❌ Tidak ada | ✅ LLM pecah jadi 4 sub-query |
| **FASE 2 - Retrieval** | 1x hybrid search | 4x parallel hybrid search |
| **FASE 2 - Context** | 8 chunks | 10-12 unique chunks |
| **FASE 2 - LLM calls** | 2 (embed + generate) | 3 (embed + decompose + generate) |
| **Latency** | ~2 detik | ~4-5 detik |
| **Coverage** | 1 aspek | 4 aspek (komprehensif) |

---

## 📍 Referensi Baris Kode

### FASE 1: Ingestion (SAMA dengan Single-hop)

| Step | Fungsi | Baris |
|------|--------|-------|
| 1 | PDF upload | 649-652 |
| 2 | PDF parse | 674 |
| 3 | Chunking | 81-156, 676 |
| 4 | Embedding | 158-176, 686-688 |
| 5 | Store Qdrant | 691-695 |
| 6 | BM25 Cache | 191-243, 697 |

### FASE 2: Multi-hop Query

| Step | Fungsi | Baris |
|------|--------|-------|
| 1 | Query decomposition | 491-543, 831 |
| 2 | Parallel retrieval | 834-839 |
| 3 | Merge + deduplicate | 841-862 |
| 4 | Build context | 873-875 |
| 5 | LLM synthesis | 907-920 |
| 6 | Validate + return | 944-955 |

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, alur Multi-hop ada 2 fase:"**

### **FASE 1: Ingestion** (SAMA dengan Single-hop)
1. Admin upload PDF
2. Parse → Chunk → Embed → Store → BM25 Cache

### **FASE 2: Multi-hop Query**
1. **"LLM pecah pertanyaan"** (baris 491-543) ⭐ INI BEDANYA!
   - "Jelaskan yudisium lengkap" → 4 sub-query

2. **"4x Parallel Hybrid Search"** (baris 834-839)
   - Promise.all: 4 search bersamaan
   - Dapat 16 chunks total

3. **"Merge + Deduplicate"** (baris 841-862)
   - Gabungkan dengan label (overview/detail/aturan/penutup)
   - Hapus duplikat → ~10-12 unique chunks

4. **"LLM Synthesize"** (baris 907-920)
   - Generate jawaban komprehensif dari 4 aspek

5. **"Validate + Return"** (baris 944-955)
   - Pastikan ada sitasi [#N]

**Waktu: ~4-5 detik, tapi jawaban JAUH LEBIH LENGKAP!**

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan FASE 1 (6 step, SAMA dengan Single-hop)
- [ ] Bisa jelaskan FASE 2 (6 step Multi-hop)
- [ ] Bisa jelaskan kenapa butuh decomposition
- [ ] Bisa jelaskan kenapa parallel retrieval
- [ ] Bisa jelaskan perbedaan dengan single-hop
- [ ] Bisa tunjukkan baris kode setiap step
