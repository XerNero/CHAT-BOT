# TODO 2: Siapkan Penjelasan Teknis

## Deskripsi
Siapkan penjelasan untuk setiap komponen teknis yang mungkin ditanyakan dosen.

---

## Komponen yang Harus Bisa Dijelaskan

### 1. Cara Chunking PDF
**Lokasi:** `server.mjs` baris 81-156

- Fungsi: `chunkText(text, maxChars=800, overlap=150)`
- Smart chunking yang menghormati paragraf dan kalimat
- Deteksi heading (BAB, Pasal, dll)
- Overlap untuk menjaga konteks

### 2. Cara Embedding
**Lokasi:** `server.mjs` baris 158-176

- Fungsi: `embedWithOllama(text)`
- Model: `llama3:8b`
- Output: Vektor 4096 dimensi
- API: `POST /api/embeddings`

### 3. Hybrid Retrieval
**Lokasi:** `server.mjs` baris 436-486

- Fungsi: `hybridRetrieve(queryText, topK)`
- Kombinasi Vector Search + BM25
- Vector untuk makna, BM25 untuk kata kunci
- Digabung dengan RRF

### 4. Formula RRF
**Lokasi:** `server.mjs` baris 311-316

- Fungsi: `rrfFuse(rankA, rankB, k=60)`
- Formula: `score = 1/(k+rank_vector) + 1/(k+rank_bm25)`
- Semakin tinggi skor, semakin relevan

### 5. Multi-hop
**Lokasi:** `server.mjs` baris 491-543, 823-956

- Fungsi: `decomposeQuery(question)`
- Pecah jadi 4 sub-query
- Retrieval 4x parallel
- Merge hasil, generate jawaban

---

## Checklist

- [ ] Bisa jelaskan chunking + tunjukkan kode
- [ ] Bisa jelaskan embedding + tunjukkan kode
- [ ] Bisa jelaskan hybrid retrieval + tunjukkan kode
- [ ] Bisa jelaskan formula RRF + contoh perhitungan
- [ ] Bisa jelaskan multi-hop + diagram
