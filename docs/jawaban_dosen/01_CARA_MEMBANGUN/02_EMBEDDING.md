# Pertanyaan 3: Bagaimana Cara Meng-embed Data?

## Pertanyaan Dosen
> "Nah ini bagaimana cara kita meng-embed, tadi parameter apa, variable apa, bagaimana kita membangunnya?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, embedding itu mengubah teks jadi angka-angka (vektor) supaya komputer bisa menghitung kesamaan makna.**

**Saya pakai model llama3:8b dari Ollama:**
- Input: Teks biasa ("Syarat yudisium...")
- Output: Array 4096 angka ([0.123, -0.456, ...])
- Angka-angka ini merepresentasikan MAKNA teks"

---

## 📖 Penjelasan Detail untuk Dosen

### Apa Itu Embedding?

**Analogi Sederhana:**

```
Teks: "kucing"  →  Vektor: [0.9, 0.1, 0.8, 0.3, ...]
Teks: "anjing"  →  Vektor: [0.8, 0.2, 0.7, 0.4, ...]  (mirip kucing)
Teks: "mobil"   →  Vektor: [0.1, 0.9, 0.2, 0.8, ...]  (beda jauh)
```

- "Kucing" dan "anjing" → vektor mirip (keduanya hewan)
- "Kucing" dan "mobil" → vektor beda jauh

**Dengan embedding, kita bisa menghitung:**
- "Syarat yudisium" MIRIP dengan "Persyaratan kelulusan" (meski kata beda)
- "Syarat yudisium" BEDA dengan "Cara membuat nasi goreng"

---

### Konfigurasi Model Embedding

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 63-68

```javascript
// URL Ollama server
const OLLAMA_URL = `http://${WIN_HOST}:11434`;

// Collection name di Qdrant
const COLLECTION_NAME = "pdf_chunks";

// Model untuk chat dan embedding (sama)
const CHAT_MODEL = "llama3:8b";   // Untuk generate jawaban
const EMBED_MODEL = "llama3:8b"; // Untuk embedding
```

**Parameter:**

| Parameter | Nilai | Fungsi |
|-----------|-------|--------|
| `OLLAMA_URL` | `http://172.17.112.1:11434` | URL API Ollama |
| `EMBED_MODEL` | `"llama3:8b"` | Model untuk embedding |
| `Dimensi Output` | `4096` | Ukuran vektor |

---

### Fungsi Embedding

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 158-176  
**📋 Fungsi:** `embedWithOllama()`

```javascript
async function embedWithOllama(text) {
  // 1. Kirim request ke Ollama API
  const { body, statusCode } = await request(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 
      model: EMBED_MODEL,           // "llama3:8b"
      prompt: String(text || "")    // Teks yang akan di-embed
    }),
  });

  // 2. Validasi response
  if (statusCode < 200 || statusCode >= 300) {
    const errText = await body.text();
    throw new Error(`Ollama embeddings failed: ${statusCode} ${errText}`);
  }

  // 3. Parse JSON response
  const json = await body.json();
  
  // 4. Validasi format embedding
  if (!json?.embedding || !Array.isArray(json.embedding)) {
    throw new Error("Ollama embeddings response invalid (no embedding array).");
  }

  // 5. Return array of numbers
  return json.embedding;  // [0.123, -0.456, 0.789, ...] (4096 angka)
}
```

---

### Alur Request-Response

**Request ke Ollama:**
```json
POST http://172.17.112.1:11434/api/embeddings
Content-Type: application/json

{
  "model": "llama3:8b",
  "prompt": "Syarat yudisium adalah mahasiswa harus menyelesaikan semua mata kuliah"
}
```

**Response dari Ollama:**
```json
{
  "embedding": [
    0.012345,
    -0.067890,
    0.123456,
    -0.234567,
    0.345678,
    // ... total 4096 angka
    0.987654
  ]
}
```

---

### Diagram Proses Embedding

```
┌─────────────────────────────────────────────────────────────────┐
│                      EMBEDDING PROCESS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│  ┌─────────────────────────────────────────┐                    │
│  │ "Syarat yudisium adalah mahasiswa       │                    │
│  │  harus menyelesaikan semua mata kuliah" │                    │
│  └─────────────────────────────────────────┘                    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────┐                    │
│  │           embedWithOllama()             │                    │
│  │                                         │                    │
│  │  POST http://localhost:11434/api/embeddings                  │
│  │  {                                      │                    │
│  │    "model": "llama3:8b",                │                    │
│  │    "prompt": "Syarat yudisium..."       │                    │
│  │  }                                      │                    │
│  └─────────────────────────────────────────┘                    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────┐                    │
│  │            OLLAMA SERVER                │                    │
│  │                                         │                    │
│  │  Model: llama3:8b                       │                    │
│  │  Process: Neural network forward pass   │                    │
│  │  Output dimension: 4096                 │                    │
│  └─────────────────────────────────────────┘                    │
│                        │                                         │
│                        ▼                                         │
│  OUTPUT:                                                         │
│  ┌─────────────────────────────────────────┐                    │
│  │ [                                       │                    │
│  │   0.012345,   // dimensi 1              │                    │
│  │  -0.067890,   // dimensi 2              │                    │
│  │   0.123456,   // dimensi 3              │                    │
│  │   ...         // ... 4093 lagi          │                    │
│  │   0.987654    // dimensi 4096           │                    │
│  │ ]                                       │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Penggunaan Embedding dalam Sistem

#### 1. Saat Ingestion (Simpan Data)

**📍 Baris:** 670-678

```javascript
// Embed setiap chunk dan simpan ke Qdrant
for (let idx = 0; idx < chunks.length; idx++) {
  const vec = await embedWithOllama(chunks[idx]);  // <-- EMBEDDING
  
  points.push({
    id: batchId + idx,
    vector: vec,          // Simpan vektor
    payload: {
      text: chunks[idx],  // Simpan teks asli juga
      // ...
    },
  });
}
```

#### 2. Saat Pencarian (Retrieval)

**📍 Baris:** 437

```javascript
async function hybridRetrieve(queryText, topK = 6) {
  // Embed pertanyaan user
  const qVec = await embedWithOllama(queryText);  // <-- EMBEDDING
  
  // Cari chunk yang vektornya mirip
  const vectorHits = await qdrant.search(COLLECTION_NAME, {
    vector: qVec,  // Bandingkan vektor pertanyaan dengan vektor chunks
    limit: topK * 2,
  });
  // ...
}
```

---

### Kenapa Dimensi 4096?

**Model llama3:8b memiliki:**
- 8 billion (8 miliar) parameter
- Hidden dimension: 4096
- Ini "kapasitas" model untuk menyimpan makna

**Semakin banyak dimensi:**
- ✅ Lebih detail dalam menangkap nuansa makna
- ❌ Butuh lebih banyak storage
- ❌ Perhitungan lebih lama

**4096 adalah sweet spot** untuk model ukuran ini.

---

### Bagaimana Qdrant Menghitung Kesamaan?

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 183-186

```javascript
await qdrant.createCollection(COLLECTION_NAME, {
  vectors: { 
    size: vectorSize,      // 4096
    distance: "Cosine"     // Metrik kesamaan
  },
});
```

**Cosine Similarity:**

```
                    A · B
Similarity = ─────────────────
              ||A|| × ||B||

Range: -1 sampai 1
- 1 = identik
- 0 = tidak ada hubungan
- -1 = berlawanan
```

**Contoh:**
- Vektor "syarat yudisium" vs vektor "persyaratan kelulusan" → 0.92 (sangat mirip)
- Vektor "syarat yudisium" vs vektor "resep masakan" → 0.15 (tidak mirip)

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, begini cara saya meng-embed data:"**

1. **"Saya pakai model llama3:8b dari Ollama"** (baris 68)
   - Model ini cukup kuat untuk bahasa Indonesia
   - Bisa dijalankan lokal, tidak perlu internet

2. **"Setiap teks diubah jadi vektor 4096 angka"** (baris 158-176)
   - Request ke Ollama API `/api/embeddings`
   - Model memproses teks → output array angka

3. **"Angka-angka ini merepresentasikan MAKNA"**
   - Teks yang maknanya mirip → vektor mirip
   - Diukur dengan Cosine Similarity

4. **"Vektor disimpan ke Qdrant"** (baris 183)
   - Collection dengan dimensi 4096
   - Distance: Cosine

5. **"Saat cari, pertanyaan juga di-embed"** (baris 437)
   - Pertanyaan user → vektor
   - Cari chunk yang vektornya paling mirip

**"Parameter yang saya pakai, Pak:"**
| Parameter | Nilai |
|-----------|-------|
| Model | llama3:8b |
| Dimensi | 4096 |
| Distance | Cosine |
| API | POST /api/embeddings |

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan apa itu embedding dan fungsinya
- [ ] Bisa sebutkan model dan dimensi yang dipakai
- [ ] Bisa jelaskan alur request-response ke Ollama
- [ ] Bisa jelaskan Cosine Similarity
- [ ] Bisa tunjukkan fungsi `embedWithOllama()` (baris 158-176)
- [ ] Bisa jelaskan penggunaan embedding: saat ingestion & retrieval
