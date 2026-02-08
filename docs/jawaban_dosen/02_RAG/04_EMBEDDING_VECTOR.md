# Pertanyaan 14: Bagaimana Embedding Terhubung dengan Vector Search?

## Pertanyaan Dosen
> "Embedding itu hubungannya dengan Vector Search bagaimana? Kenapa harus di-embed dulu?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, Embedding dan Vector Search terhubung erat:**
1. **Embedding** = mengubah teks jadi vektor (angka-angka)
2. **Vector Search** = mencari vektor yang MIRIP

**Tanpa embedding, tidak bisa vector search. Karena komputer tidak bisa menghitung 'kemiripan makna' dari teks biasa, harus dalam bentuk angka (vektor)."**

---

## 📖 Penjelasan Detail

### Kenapa Harus Embedding?

**Masalah:** Komputer tidak mengerti teks secara langsung.

```
Teks: "Apa syarat yudisium?"
Komputer: ??? (tidak bisa dihitung)

Vektor: [0.123, -0.456, 0.789, ...]
Komputer: Bisa dihitung jaraknya!
```

**Embedding mengubah MAKNA menjadi ANGKA yang bisa dihitung.**

---

### Hubungan Embedding → Vector Search

```
┌─────────────────────────────────────────────────────────────────┐
│            EMBEDDING → VECTOR SEARCH PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INGESTION TIME (Sekali saat upload PDF):                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Chunk: "Syarat yudisium adalah lulus semua MK"     │       │
│  │                      │                               │       │
│  │                      ▼                               │       │
│  │            ┌─────────────────┐                      │       │
│  │            │ embedWithOllama │                      │       │
│  │            └────────┬────────┘                      │       │
│  │                     │                               │       │
│  │                     ▼                               │       │
│  │  Vector: [0.12, -0.45, 0.78, ...] (4096 dimensi)   │       │
│  │                     │                               │       │
│  │                     ▼                               │       │
│  │            ┌─────────────────┐                      │       │
│  │            │  Qdrant (store) │ ← Simpan vektor     │       │
│  │            └─────────────────┘                      │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  QUERY TIME (Setiap user bertanya):                             │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Question: "Apa persyaratan kelulusan?"             │       │
│  │                      │                               │       │
│  │                      ▼                               │       │
│  │            ┌─────────────────┐                      │       │
│  │            │ embedWithOllama │ ← Embed pertanyaan   │       │
│  │            └────────┬────────┘                      │       │
│  │                     │                               │       │
│  │                     ▼                               │       │
│  │  Query Vector: [0.13, -0.44, 0.77, ...]            │       │
│  │                     │                               │       │
│  │                     ▼                               │       │
│  │            ┌─────────────────┐                      │       │
│  │            │ qdrant.search() │ ← Vector Search     │       │
│  │            └────────┬────────┘                      │       │
│  │                     │                               │       │
│  │                     ▼                               │       │
│  │  Hasil: Chunk "Syarat yudisium..." (skor: 0.92)    │       │
│  │                                                      │       │
│  │  Note: "syarat" ≈ "persyaratan", "yudisium" ≈ "kelulusan"   │
│  │        Bisa matching meski KATA BERBEDA!            │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Kode: Embedding

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 158-176

```javascript
async function embedWithOllama(text) {
  const { body } = await request(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    body: JSON.stringify({ 
      model: EMBED_MODEL,  // llama3:8b
      prompt: text 
    }),
  });
  
  const json = await body.json();
  return json.embedding;  // [0.12, -0.45, ...] (4096 angka)
}
```

---

### Kode: Vector Search

**📍 Baris:** 439-448

```javascript
// 1. Embed pertanyaan user
const qVec = await embedWithOllama(queryText);

// 2. Cari di Qdrant
const vectorHits = await qdrant.search(COLLECTION_NAME, {
  vector: qVec,         // Vektor pertanyaan
  limit: topK * 2,      // Ambil top results
  with_payload: true,   // Sertakan teks asli
});

// Qdrant menghitung Cosine Similarity antara qVec dan setiap vektor di database
// Return chunks yang paling mirip
```

---

### Keunggulan Vector Search

**Semantic Matching (Mengerti Makna):**

| Pertanyaan | Keyword Search | Vector Search |
|------------|----------------|---------------|
| "persyaratan kelulusan" | ❌ Tidak match "syarat yudisium" | ✅ Match! Makna sama |
| "cara lulus" | ❌ Tidak match | ✅ Match! Makna mirip |
| "IPK minimal" | ✅ Match jika ada kata "IPK" | ✅ Match juga |

**Vector Search mengerti:**
- Sinonim (syarat = persyaratan)
- Parafrase (yudisium ≈ kelulusan)
- Konteks semantik

---

### Visualisasi Vektor dalam Ruang

```
Bayangkan vektor 4096 dimensi disederhanakan jadi 2D:

        ▲ Dimensi 2
        │
        │    • "syarat yudisium"
        │        ↘
        │          • "persyaratan kelulusan" (DEKAT!)
        │
        │
        │                            • "resep nasi goreng" (JAUH!)
        │
        └──────────────────────────────────► Dimensi 1

Cosine Similarity:
- "syarat yudisium" vs "persyaratan kelulusan" = 0.92 (mirip)
- "syarat yudisium" vs "resep nasi goreng" = 0.15 (beda)
```

---

### Ringkasan Hubungan

| Komponen | Fungsi | Baris Kode |
|----------|--------|------------|
| `embedWithOllama()` | Ubah teks → vektor | 158-176 |
| `qdrant.upsert()` | Simpan vektor ke database | 691-695 |
| `qdrant.search()` | Cari vektor yang mirip | 439-448 |

**Alur:**
1. Chunk di-embed → simpan ke Qdrant (ingestion)
2. Pertanyaan di-embed → cari di Qdrant (query)
3. Return chunks yang vektornya paling mirip

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, hubungan embedding dan vector search seperti ini:"**

1. **"Embedding mengubah teks jadi angka"** (baris 158)
   - "Syarat yudisium" → [0.12, -0.45, ...]
   - Model llama3:8b yang melakukan
   - Output: vektor 4096 dimensi

2. **"Vektor disimpan di Qdrant"** (baris 691)
   - Setiap chunk punya vektornya
   - Seperti katalog di perpustakaan

3. **"Saat query, pertanyaan juga di-embed"** (baris 437)
   - "Apa persyaratan lulus?" → vektor
   - Vektor pertanyaan dibandingkan dengan semua vektor di database

4. **"Qdrant hitung Cosine Similarity"** (baris 439-448)
   - Vektor yang mirip = chunk yang relevan
   - Misalnya: "persyaratan lulus" mirip dengan "syarat yudisium"

**"Kenapa harus embedding, Pak?"**
- Komputer tidak bisa hitung "kemiripan makna" dari teks biasa
- Harus dalam bentuk angka (vektor)
- Vektor memungkinkan perhitungan matematika

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan kenapa perlu embedding
- [ ] Bisa jelaskan alur embedding → store → search
- [ ] Bisa jelaskan keunggulan vector search (semantic)
- [ ] Bisa tunjukkan kode embedding dan search
