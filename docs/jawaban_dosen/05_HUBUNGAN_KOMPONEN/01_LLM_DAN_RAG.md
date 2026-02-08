# Pertanyaan 12: Bagaimana LLM dan RAG Bekerja Sama?

## Pertanyaan Dosen
> "Jadi LLM dan RAG itu hubungannya bagaimana? Bagaimana mereka bekerja sama?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, LLM dan RAG punya peran berbeda tapi saling melengkapi:**
- **RAG** = Mencari informasi dari dokumen (Retrieval)
- **LLM** = Memahami dan merangkum informasi (Generation)

**Alurnya:**
1. RAG cari chunk yang relevan dari database
2. Chunk dikirim ke LLM sebagai context
3. LLM generate jawaban berdasarkan context"

---

## 📖 Penjelasan Detail

### Peran Masing-Masing Komponen

| Komponen | Peran | Analogi |
|----------|-------|---------|
| **RAG (Retrieval)** | Cari informasi yang relevan | Pustakawan yang cari buku |
| **LLM (Generation)** | Pahami dan rangkum informasi | Penulis yang buat ringkasan |
| **Vector DB (Qdrant)** | Simpan dokumen | Perpustakaan |
| **Embedding** | Ubah teks jadi vektor | Sistem katalog buku |

---

### Diagram Kolaborasi LLM + RAG

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM + RAG COLLABORATION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: "Apa syarat yudisium?"                                   │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │                    RAG PHASE                         │        │
│  │                 (RETRIEVAL)                          │        │
│  │                                                      │        │
│  │  1. embedWithOllama(question)                       │        │
│  │     └── LLM mengubah pertanyaan jadi vektor         │        │
│  │                                                      │        │
│  │  2. qdrant.search(vector)                           │        │
│  │     └── Cari chunk yang mirip di database           │        │
│  │                                                      │        │
│  │  3. bm25Score(question, chunks)                     │        │
│  │     └── Cari chunk dengan keyword matching          │        │
│  │                                                      │        │
│  │  4. rrfFuse(vectorRank, bm25Rank)                   │        │
│  │     └── Gabungkan hasil, ambil top-K                │        │
│  │                                                      │        │
│  │  Output: [chunk1, chunk2, chunk3, ...]              │        │
│  └─────────────────────────────────────────────────────┘        │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │                    LLM PHASE                         │        │
│  │                 (GENERATION)                         │        │
│  │                                                      │        │
│  │  5. Build Context                                   │        │
│  │     "[#1] Syarat yudisium adalah..."                │        │
│  │     "[#2] Mahasiswa harus lulus..."                 │        │
│  │                                                      │        │
│  │  6. ollamaChat(system + context + question)         │        │
│  │     └── LLM memahami context dan question           │        │
│  │     └── LLM generate jawaban dengan sitasi          │        │
│  │                                                      │        │
│  │  Output: "Syarat yudisium meliputi: 1. ... [#1]"    │        │
│  └─────────────────────────────────────────────────────┘        │
│         │                                                        │
│         ▼                                                        │
│  User mendapat jawaban yang akurat + sitasi                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### LLM Digunakan 3 Kali dalam Sistem

**📁 File:** `apps/api/server.mjs`

| Penggunaan | Fungsi | Baris | Tujuan |
|------------|--------|-------|--------|
| 1. **Embedding** | `embedWithOllama()` | 158-176 | Ubah teks jadi vektor untuk search |
| 2. **Query Decomposition** | `decomposeQuery()` | 491-543 | Pecah pertanyaan jadi 4 sub-query |
| 3. **Answer Generation** | `ollamaChat()` | 548-565 | Generate jawaban dari context |

---

### Kode: Embedding (LLM #1)

**📍 Baris:** 158-176

```javascript
async function embedWithOllama(text) {
  // LLM mengubah teks jadi vektor
  const { body } = await request(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    body: JSON.stringify({ 
      model: EMBED_MODEL,  // llama3:8b
      prompt: text 
    }),
  });
  
  return json.embedding;  // [0.123, -0.456, ...] (4096 dimensi)
}
```

---

### Kode: Query Decomposition (LLM #2) - Multi-hop Only

**📍 Baris:** 507-517

```javascript
// LLM memecah pertanyaan kompleks
const { body } = await request(`${OLLAMA_URL}/api/chat`, {
  method: "POST",
  body: JSON.stringify({
    model: CHAT_MODEL,  // llama3:8b
    messages: [{ role: "user", content: decomposePrompt }],
    stream: false,
    options: { temperature: 0.1 },
  }),
});

// Output: { overview: "...", detail: "...", aturan: "...", penutup: "..." }
```

---

### Kode: Answer Generation (LLM #3)

**📍 Baris:** 768-780

```javascript
// LLM generate jawaban dari context
const baseMessages = [
  { role: "system", content: system },     // Aturan jawaban
  ...history.slice(-6),                     // Chat history
  { role: "user", content: userPrompt },   // Context + Question
];

const chat1 = await ollamaChat(baseMessages, 0.2);
let answer = finalizeAnswer(chat1?.message?.content);
```

---

### Analogi: Peneliti + Penulis

```
RAG = Peneliti
├── Pergi ke perpustakaan (Qdrant)
├── Cari buku yang relevan (Vector Search)
├── Cari halaman yang tepat (BM25)
└── Bawa reference ke penulis

LLM = Penulis
├── Terima reference dari peneliti
├── Baca dan pahami isinya
├── Tulis ringkasan dengan bahasa sendiri
└── Tambahkan sitasi [#N]

Hasil = Artikel yang akurat + well-cited
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, LLM dan RAG bekerja sama seperti ini:"**

1. **"LLM pertama kali dipakai untuk embedding"** (baris 158)
   - Pertanyaan user diubah jadi vektor
   - Supaya bisa dicari di database

2. **"RAG mencari di database Qdrant"** (baris 436-486)
   - Vector Search + BM25 + RRF
   - Dapat chunk yang relevan

3. **"LLM kedua kali untuk decompose (multi-hop)"** (baris 507)
   - Pecah pertanyaan jadi 4 sub-query
   - Supaya dapat context lebih lengkap

4. **"LLM ketiga kali untuk generate jawaban"** (baris 778)
   - Terima context dari RAG
   - Generate jawaban dengan sitasi

**"Jadi LLM dipakai 3 kali, Pak:**
1. Embedding (RAG phase)
2. Decomposition (Multi-hop)
3. Generation (Answer)"

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan peran RAG vs LLM
- [ ] Bisa jelaskan 3 penggunaan LLM di sistem
- [ ] Bisa tunjukkan baris kode masing-masing
- [ ] Bisa gambar diagram kolaborasi
