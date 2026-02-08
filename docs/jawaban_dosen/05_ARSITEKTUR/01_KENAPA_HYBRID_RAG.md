# 🔀 KENAPA PAKAI HYBRID RAG?

## Pertanyaan Dosen
> "Kenapa pakai Hybrid RAG? Apa bedanya dengan RAG biasa? Library apa saja yang dipakai?"

---

## 🎯 Apa Itu Hybrid RAG?

**Hybrid RAG = Vector Search + Keyword Search (BM25) + RRF Fusion**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HYBRID RAG ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Query: "Apa syarat yudisium?"                                              │
│                    │                                                         │
│         ┌─────────┴─────────┐                                               │
│         │                   │                                               │
│         ▼                   ▼                                               │
│  ┌─────────────────┐ ┌─────────────────┐                                   │
│  │  VECTOR SEARCH  │ │  BM25 SEARCH    │                                   │
│  │  (Semantic)     │ │  (Keyword)      │                                   │
│  │                 │ │                 │                                   │
│  │  "Makna mirip"  │ │  "Kata cocok"   │                                   │
│  │  via embedding  │ │  via tokenize   │                                   │
│  └────────┬────────┘ └────────┬────────┘                                   │
│           │                   │                                             │
│           └─────────┬─────────┘                                             │
│                     ▼                                                        │
│           ┌─────────────────┐                                               │
│           │   RRF FUSION    │                                               │
│           │                 │                                               │
│           │  Gabungkan      │                                               │
│           │  ranking        │                                               │
│           └────────┬────────┘                                               │
│                    ▼                                                         │
│           TOP-K CHUNKS (terbaik dari keduanya!)                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Kenapa TIDAK Pakai Vector Search Saja?

### Masalah Vector Search Only:

| Kasus | Query | Vector Search Result | Masalah |
|-------|-------|---------------------|---------|
| **Istilah Teknis** | "Pasal 15 ayat 3" | ❌ Chunk random | Tidak match keyword spesifik |
| **Nama Khusus** | "Dr. Bambang" | ❌ Chunk random | Nama tidak ada di embedding |
| **Angka/Kode** | "IPK 2.75" | ❌ Chunk salah | Angka sulit di-embed |
| **Akronim** | "SKS minimal" | ❌ Miss | "SKS" tidak sama dengan "Satuan Kredit Semester" di vector space |

### Solusi: Tambahkan BM25 (Keyword Search)!

```javascript
// BM25 akan menemukan "Pasal 15 ayat 3" karena keyword match EXACT
query: "Pasal 15 ayat 3"
BM25: ✅ Chunk dengan kata "Pasal 15 ayat 3" → MATCH!
```

---

## 📊 Kenapa TIDAK Pakai BM25 Saja?

### Masalah BM25 Only:

| Kasus | Query | BM25 Result | Masalah |
|-------|-------|-------------|---------|
| **Sinonim** | "syarat kelulusan" | ❌ Miss | Dokumen pakai "persyaratan yudisium" |
| **Parafrase** | "cara daftar ulang" | ❌ Miss | Dokumen pakai "prosedur registrasi" |
| **Konteks** | "batasan waktu studi" | ❌ Miss | Dokumen pakai "masa studi maksimal" |

### Solusi: Tambahkan Vector Search!

```javascript
// Vector Search menemukan "persyaratan yudisium" karena MAKNA mirip
query: "syarat kelulusan"
Vector: ✅ Chunk "persyaratan yudisium" → Cosine Similarity tinggi!
```

---

## ✅ Hybrid RAG = Best of Both Worlds!

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     PERBANDINGAN APPROACH                                   │
├──────────────────┬───────────────┬───────────────┬────────────────────────┤
│      Aspek       │ Vector Only   │  BM25 Only    │    HYBRID RAG ✅       │
├──────────────────┼───────────────┼───────────────┼────────────────────────┤
│ Semantic Match   │     ✅        │      ❌       │         ✅             │
│ Keyword Match    │     ❌        │      ✅       │         ✅             │
│ Istilah Teknis   │     ❌        │      ✅       │         ✅             │
│ Sinonim          │     ✅        │      ❌       │         ✅             │
│ Nama/Angka       │     ❌        │      ✅       │         ✅             │
│ Parafrase        │     ✅        │      ❌       │         ✅             │
├──────────────────┼───────────────┼───────────────┼────────────────────────┤
│ Coverage         │    ~70%       │     ~60%      │       ~90%+ ✅         │
└──────────────────┴───────────────┴───────────────┴────────────────────────┘
```

---

## 🔧 LIBRARY RAG YANG DIGUNAKAN

### 1. Vector Database: **Qdrant**

```javascript
// 📍 Baris: 8, 42-45
import { QdrantClient } from "@qdrant/js-client-rest";

const qdrant = new QdrantClient({ 
  host: process.env.QDRANT_HOST || "localhost", 
  port: 6333 
});
```

**Kenapa Qdrant?**
| Fitur | Qdrant | Alternatif (Pinecone, Weaviate) |
|-------|--------|--------------------------------|
| Open Source | ✅ | ❌ (Pinecone berbayar) |
| Self-hosted | ✅ | ❌ (Pinecone cloud-only) |
| Performance | ✅ Cepat | Comparable |
| Docker Ready | ✅ | ✅ |
| Gratis | ✅ | ❌ (Pinecone limit) |

---

### 2. Embedding Model: **Ollama + llama3:8b**

```javascript
// 📍 Baris: 158-176
async function embedWithOllama(text) {
  const res = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama3", prompt: text }),
  });
  const { embedding } = await res.json();
  return embedding;  // 4096 dimensi
}
```

**Kenapa Ollama + llama3?**
| Fitur | Ollama | Alternatif (OpenAI) |
|-------|--------|-------------------|
| Gratis | ✅ | ❌ $0.0001/1K tokens |
| Privacy | ✅ Local | ❌ Data ke cloud |
| Offline | ✅ | ❌ |
| Customizable | ✅ | ❌ |
| Performance | ✅ (dengan GPU) | ✅ |

---

### 3. BM25 Search: **Custom Implementation**

```javascript
// 📍 Baris: 245-310
function bm25Score(queryTokens, docTokens, df, avgdl, k1 = 1.2, b = 0.75) {
  const docLen = docTokens.length;
  let score = 0;
  for (const qt of queryTokens) {
    const tf = docTokens.filter(t => t === qt).length;
    const idf = Math.log((N - df.get(qt) + 0.5) / (df.get(qt) + 0.5) + 1);
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgdl));
    score += idf * tfNorm;
  }
  return score;
}
```

**Kenapa Custom BM25?**
| Fitur | Custom | Alternatif (Elasticsearch) |
|-------|--------|---------------------------|
| Lightweight | ✅ In-memory | ❌ Perlu server terpisah |
| No Dependencies | ✅ | ❌ JVM, cluster |
| Control | ✅ Full | ❌ Black box |
| Untuk skala kecil | ✅ Perfect | ❌ Overkill |

---

### 4. RRF Fusion: **Custom Implementation**

```javascript
// 📍 Baris: 311-340
function rrfFuse(vectorRanks, keywordRanks, k = 60) {
  const scores = new Map();
  
  // Dari vector search
  for (const [id, rank] of vectorRanks) {
    scores.set(id, (scores.get(id) || 0) + 1 / (k + rank));
  }
  
  // Dari BM25 search
  for (const [id, rank] of keywordRanks) {
    scores.set(id, (scores.get(id) || 0) + 1 / (k + rank));
  }
  
  return scores;
}
```

**Kenapa RRF?**
| Metode Fusion | Kelebihan | Kekurangan |
|---------------|-----------|------------|
| **RRF** ✅ | Simple, robust, normalization-free | - |
| Linear Combination | Perlu tuning weight | Sensitif ke skor range |
| Borda Count | Classic | Kurang robust |

---

### 5. PDF Parsing: **pdf-parse**

```javascript
// 📍 Baris: 7, 674
import pdfParse from "pdf-parse";

const pdfData = await pdfParse(buffer);
const fullText = pdfData.text;
```

**Kenapa pdf-parse?**
| Fitur | pdf-parse | Alternatif |
|-------|-----------|------------|
| NPM Package | ✅ | PyPDF (Python only) |
| Lightweight | ✅ ~500KB | Tika (~100MB) |
| Text Extract | ✅ | ✅ |
| Maintenance | ✅ Active | ✅ |

---

### 6. LLM Generation: **Ollama + llama3:8b**

```javascript
// 📍 Baris: 548-565
async function ollamaChat(messages, temp = 0.2) {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3",
      messages,
      stream: false,
      options: { temperature: temp }
    }),
  });
  return res.json();
}
```

---

### 7. Web Framework: **Fastify**

```javascript
// 📍 Baris: 5, 626-628
import Fastify from "fastify";

const app = Fastify({ logger: true });
await app.listen({ port: PORT, host: "0.0.0.0" });
```

**Kenapa Fastify?**
| Fitur | Fastify | Express |
|-------|---------|---------|
| Performance | ✅ 2x lebih cepat | ✅ Standard |
| TypeScript | ✅ Built-in | ❌ Perlu config |
| Validation | ✅ Built-in | ❌ Perlu middleware |
| Modern | ✅ | ❌ Legacy design |

---

## 📦 RINGKASAN LIBRARY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TECH STACK RAG                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  RETRIEVAL LAYER:                                                           │
│  ├── Vector DB:     @qdrant/js-client-rest (Qdrant)                        │
│  ├── Embedding:     Ollama API (llama3:8b) - local                         │
│  ├── BM25:          Custom implementation (in-memory)                      │
│  └── Fusion:        Custom RRF (k=60)                                      │
│                                                                              │
│  GENERATION LAYER:                                                          │
│  └── LLM:           Ollama API (llama3:8b) - local                         │
│                                                                              │
│  PROCESSING LAYER:                                                          │
│  ├── PDF Parse:     pdf-parse                                              │
│  ├── Chunking:      Custom smart chunking (800 char, 150 overlap)          │
│  └── Tokenize:      Custom tokenization + stopword filter                  │
│                                                                              │
│  WEB LAYER:                                                                 │
│  ├── Framework:     Fastify                                                │
│  ├── File Upload:   @fastify/multipart                                     │
│  ├── CORS:          @fastify/cors                                          │
│  └── Static:        @fastify/static                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, saya pakai Hybrid RAG karena:"**

1. **"Vector Search saja tidak cukup"**
   - Tidak bisa handle istilah teknis, nama, angka
   - Miss kalau kata tidak ada di training data

2. **"BM25 saja juga tidak cukup"**
   - Tidak paham sinonim
   - Tidak bisa handle parafrase

3. **"Hybrid = gabungan keduanya"**
   - Vector: tangkap makna/semantik
   - BM25: tangkap keyword exact
   - RRF: gabungkan ranking dengan adil

4. **"Library yang dipakai:"**
   - Qdrant: vector database (open source, self-hosted)
   - Ollama: LLM lokal (gratis, privacy)
   - pdf-parse: extract teks dari PDF
   - Custom BM25 & RRF: lightweight, full control

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan kelemahan Vector Search only
- [ ] Bisa jelaskan kelemahan BM25 only
- [ ] Bisa jelaskan kenapa Hybrid lebih baik
- [ ] Bisa sebutkan library yang dipakai dan alasannya
- [ ] Bisa jelaskan formula RRF
