# Pertanyaan 2: Bagaimana Cara Menyiapkan Data Supaya Bisa Dibaca RAG?

## Pertanyaan Dosen
> "Bagaimana cara database dokumennya, bagaimana cara bisa menjelaskan, membuat dia dalam bentuk yang bisa dibaca oleh RAG?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, data PDF saya siapkan dengan proses INGESTION:**
1. **Upload PDF** → Ekstrak teksnya
2. **Smart Chunking** → Potong jadi bagian kecil (~800 karakter)
3. **Embedding** → Setiap chunk diubah jadi vektor
4. **Simpan ke Qdrant** → Database vektor

**Setelah itu, RAG bisa mencari dari database ini."**

---

## 📖 Penjelasan Detail untuk Dosen

### Langkah 1: User Upload PDF

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 637-651  
**📋 Endpoint:** `POST /ingest`

```javascript
app.post("/ingest", async (req, reply) => {
  // 1. Terima file dari form-data
  const data = await req.file();
  
  // 2. Validasi: Harus PDF
  if (data.mimetype !== "application/pdf") {
    return reply.code(400).send({ ok: false, message: "File must be a PDF" });
  }

  // 3. Baca file ke buffer (binary)
  const buf = await data.toBuffer();
  
  // 4. Ambil parameter chunking dari query (optional)
  const maxChars = Number(req.query?.maxChars ?? 1200);  // Default 1200 karakter
  const overlap = Number(req.query?.overlap ?? 200);     // Default 200 overlap
  
  // ... lanjut ke langkah berikutnya
});
```

**Penjelasan:**
- User upload file PDF via form-data (field name: "file")
- Server validasi apakah benar PDF
- File dibaca sebagai binary buffer

---

### Langkah 2: Ekstraksi Teks dari PDF

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 655-663

```javascript
// Library pdf-parse mengekstrak teks dari PDF
const parsed = await pdfParse(buf);
const fullText = (parsed?.text ?? "").trim();

// Validasi: PDF harus ada teksnya
if (!fullText) {
  return reply.code(400).send({
    ok: false,
    message: "PDF has no extractable text. If this is scanned PDF, you need OCR.",
  });
}
```

**Penjelasan:**
- Library `pdf-parse` membaca PDF dan mengekstrak semua teks
- Jika PDF hasil scan (gambar), tidak ada teks → error
- Teks yang terekstrak bisa ribuan karakter

**Contoh Output:**
```
"BAB I KETENTUAN UMUM

Pasal 1
Dalam peraturan ini yang dimaksud dengan:
1. Mahasiswa adalah peserta didik yang terdaftar...
2. Dosen adalah pendidik profesional..."

(total bisa 50.000+ karakter untuk 1 PDF)
```

---

### Langkah 3: Smart Chunking (Potong Teks)

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 81-156  
**📋 Fungsi:** `chunkText()`

```javascript
function chunkText(text, maxChars = 800, overlap = 150) {
  // 1. Bersihkan teks (hapus karakter aneh)
  const cleaned = String(text || "")
    .replace(/\r/g, "")           // Hapus carriage return
    .replace(/[ \t]+\n/g, "\n")   // Hapus spasi di akhir baris
    .replace(/\n{3,}/g, "\n\n")   // Maksimal 2 newline
    .trim();

  if (!cleaned) return [];

  // 2. Split berdasarkan paragraf (double newline)
  const paragraphs = cleaned.split(/\n\n+/);

  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // 3. Deteksi heading baru (BAB, Pasal, dll)
    const isNewSection = /^(BAB|BAGIAN|PASAL|ARTIKEL|PERATURAN|KETENTUAN)/i.test(trimmedPara);

    // 4. Jika heading baru, simpan chunk sebelumnya
    if (isNewSection && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    // 5. Jika menambahkan paragraf ini melebihi maxChars
    if (currentChunk.length + trimmedPara.length + 2 > maxChars) {
      // Simpan chunk saat ini
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());

        // 6. Buat overlap: ambil 2 kalimat terakhir
        const sentences = currentChunk.split(/(?<=[.!?])\s+/);
        const overlapText = sentences.slice(-2).join(" ");
        currentChunk = overlapText.length < overlap * 2 ? overlapText + "\n\n" : "";
      }

      // 7. Jika paragraf tunggal terlalu panjang, pecah per kalimat
      if (trimmedPara.length > maxChars) {
        const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
        // ... proses per kalimat
      } else {
        currentChunk += trimmedPara;
      }
    } else {
      // Tambahkan paragraf ke chunk saat ini
      currentChunk += (currentChunk ? "\n\n" : "") + trimmedPara;
    }
  }

  // 8. Simpan chunk terakhir
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // 9. Filter chunk yang terlalu pendek
  return chunks.filter(c => c.length >= 50);
}
```

**Penjelasan Smart Chunking:**

| Fitur | Deskripsi |
|-------|-----------|
| **Paragraf-aware** | Tidak memotong di tengah paragraf |
| **Kalimat-aware** | Jika paragraf terlalu panjang, potong per kalimat |
| **Heading detection** | Deteksi BAB, Pasal → mulai chunk baru |
| **Overlap** | 2 kalimat terakhir diulang di chunk berikutnya |
| **Min length** | Chunk < 50 karakter diabaikan |

**Contoh Hasil Chunking:**

```
Chunk 0: "BAB I KETENTUAN UMUM. Pasal 1. Dalam peraturan ini yang dimaksud dengan: 1. Mahasiswa adalah peserta didik yang terdaftar..."

Chunk 1: "...peserta didik yang terdaftar dan menempuh pendidikan. 2. Dosen adalah pendidik profesional dan ilmuwan..."

Chunk 2: "BAB II PENERIMAAN MAHASISWA BARU. Pasal 2. Penerimaan mahasiswa baru dilakukan melalui seleksi..."
```

---

### Langkah 4: Embedding Setiap Chunk

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 670-689

```javascript
// 1. Embed chunk pertama untuk mendapatkan ukuran vektor
const firstVec = await embedWithOllama(chunks[0]);

// 2. Pastikan collection ada di Qdrant
await ensureCollection(firstVec.length);  // 4096 dimensi

// 3. Buat batch ID (timestamp) untuk tracking
const batchId = Date.now();
const sourceFile = data.filename || "uploaded.pdf";

// 4. Proses setiap chunk
const points = [];
for (let idx = 0; idx < chunks.length; idx++) {
  // Embed chunk ke vektor
  const vec = idx === 0 ? firstVec : await embedWithOllama(chunks[idx]);
  
  // Buat point dengan metadata
  points.push({
    id: batchId + idx,              // ID unik: timestamp + index
    vector: vec,                     // Vektor 4096 dimensi
    payload: {
      source_file: sourceFile,       // "peraturan_akademik.pdf"
      chunk_index: idx,              // 0, 1, 2, ...
      text: chunks[idx],             // Teks asli chunk
      batch_id: batchId,             // Untuk tracking
    },
  });
}
```

**Penjelasan:**
- Setiap chunk diubah jadi vektor 4096 dimensi
- Vektor + metadata disimpan sebagai "point"
- Metadata penting untuk:
  - `source_file` → Tahu dari PDF mana
  - `chunk_index` → Urutan dalam PDF
  - `text` → Teks asli untuk ditampilkan

---

### Langkah 5: Simpan ke Qdrant Database

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 691-700

```javascript
// 1. Upsert semua points ke Qdrant
await qdrant.upsert(COLLECTION_NAME, { 
  wait: true,    // Tunggu sampai selesai
  points        // Array of points
});

// 2. Refresh cache untuk BM25 search
await loadKeywordCache();

// 3. Return response sukses
return reply.send({
  ok: true,
  collection: COLLECTION_NAME,      // "pdf_chunks"
  chunks: chunks.length,            // Jumlah chunks
  source_file: sourceFile,          // Nama file
  chunking: { maxChars, overlap },  // Parameter yang dipakai
});
```

**Penjelasan:**
- `upsert` = insert atau update jika sudah ada
- `wait: true` = blocking sampai data masuk
- Cache di-refresh untuk BM25 search

---

## 📊 Diagram Alur Lengkap Ingestion

```
┌─────────────────────────────────────────────────────────────────┐
│                      INGESTION PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │ 📄 PDF Upload   │ POST /ingest                               │
│  │ (25MB max)      │ form-data: "file"                          │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 📝 pdf-parse    │ Ekstrak teks dari PDF                      │
│  │ (library)       │ Output: string 50.000+ karakter            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ ✂️ chunkText()  │ Smart Chunking                             │
│  │                 │ • maxChars = 800                           │
│  │                 │ • overlap = 150                            │
│  │                 │ • Deteksi BAB/Pasal                        │
│  │                 │ Output: Array of chunks                    │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 🧮 embedWith    │ Untuk SETIAP chunk:                        │
│  │    Ollama()     │ Teks → Vektor [4096 angka]                 │
│  │                 │ Model: llama3:8b                           │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 💾 qdrant.      │ Simpan ke database:                        │
│  │    upsert()     │ {                                          │
│  │                 │   id: 1234567890,                          │
│  │                 │   vector: [0.123, ...],                    │
│  │                 │   payload: {                               │
│  │                 │     source_file: "akademik.pdf",           │
│  │                 │     chunk_index: 0,                        │
│  │                 │     text: "BAB I..."                       │
│  │                 │   }                                        │
│  │                 │ }                                          │
│  └─────────────────┘                                            │
│                                                                  │
│  ✅ Response: { ok: true, chunks: 45 }                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Struktur Data di Qdrant

```
Collection: "pdf_chunks"
├── Vector Size: 4096
├── Distance: Cosine
│
├── Point 1:
│   ├── id: 1704067200000
│   ├── vector: [0.123, -0.456, 0.789, ...] (4096 angka)
│   └── payload:
│       ├── source_file: "peraturan_akademik.pdf"
│       ├── chunk_index: 0
│       ├── text: "BAB I KETENTUAN UMUM..."
│       └── batch_id: 1704067200000
│
├── Point 2:
│   ├── id: 1704067200001
│   ├── vector: [0.234, -0.567, 0.890, ...]
│   └── payload:
│       ├── source_file: "peraturan_akademik.pdf"
│       ├── chunk_index: 1
│       ├── text: "Pasal 1. Dalam peraturan..."
│       └── batch_id: 1704067200000
│
└── ... (bisa ratusan points)
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, begini cara saya menyiapkan data PDF supaya bisa dibaca RAG:"**

1. **"PDF diupload ke endpoint /ingest"** (baris 637)
   - User upload via Postman atau UI
   - Server terima sebagai binary

2. **"Teks diekstrak pakai library pdf-parse"** (baris 655)
   - PDF → string panjang (bisa 50.000+ karakter)
   - Kalau PDF scan, tidak bisa (butuh OCR)

3. **"Teks dipotong jadi chunks kecil"** (baris 665, fungsi baris 81)
   - Maksimal 800 karakter per chunk
   - Overlap 150 karakter supaya konteks tidak hilang
   - Deteksi BAB, Pasal sebagai pemisah alami

4. **"Setiap chunk di-embed jadi vektor"** (baris 678)
   - Model llama3:8b
   - Output: array 4096 angka
   - Angka ini merepresentasikan makna teks

5. **"Vektor + metadata disimpan ke Qdrant"** (baris 691)
   - Metadata: nama file, nomor chunk, teks asli
   - Nanti RAG bisa cari dari database ini

**"Kenapa harus di-chunk, Pak?"**
- LLM punya batas input (context window)
- Chunk kecil → pencarian lebih presisi
- Overlap → tidak ada informasi yang terpotong

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan proses upload PDF sampai tersimpan
- [ ] Bisa jelaskan kenapa perlu chunking
- [ ] Bisa jelaskan parameter chunking (maxChars, overlap)
- [ ] Bisa jelaskan apa yang disimpan di database
- [ ] Bisa tunjukkan semua baris kode yang relevan
