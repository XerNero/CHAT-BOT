# Bagaimana Sistem Melakukan Chunking PDF

## Pertanyaan Dosen
> "Bagaimana cara sistem memotong-motong (chunk) data dari PDF?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, proses chunking dari PDF ada 3 tahap:**
1. **PDF Upload** → Extract teks dengan `pdf-parse`
2. **Text Cleaning** → Bersihkan whitespace, normalize
3. **Smart Chunking** → Potong per paragraf, deteksi heading, overlap

**Hasil: Chunk ~800 karakter yang fokus pada 1 topik/pasal."**

---

## 📖 Alur Lengkap: PDF → Chunks

```
┌─────────────────────────────────────────────────────────────────┐
│                    PDF → CHUNKS PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. USER UPLOAD PDF                                             │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  peraturan_akademik.pdf (2MB)                       │       │
│  └─────────────────────────────────────────────────────┘       │
│                          │                                       │
│                          ▼                                       │
│  2. PDF PARSE (Extract Text)                                    │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  const pdfParse = require('pdf-parse');             │       │
│  │  const result = await pdfParse(buffer);             │       │
│  │  const fullText = result.text;  // ~50,000 karakter │       │
│  └─────────────────────────────────────────────────────┘       │
│                          │                                       │
│                          ▼                                       │
│  3. TEXT CLEANING                                               │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  - Hapus \r (carriage return)                       │       │
│  │  - Normalize whitespace berlebih                    │       │
│  │  - Trim leading/trailing spaces                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                          │                                       │
│                          ▼                                       │
│  4. SMART CHUNKING                                              │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Features:                                          │       │
│  │  ├── Split per PARAGRAF (bukan per karakter)       │       │
│  │  ├── Deteksi HEADING (BAB, Pasal, Artikel)         │       │
│  │  ├── Max 800 karakter per chunk                    │       │
│  │  └── OVERLAP 150 karakter (konteks tidak hilang)   │       │
│  └─────────────────────────────────────────────────────┘       │
│                          │                                       │
│                          ▼                                       │
│  5. OUTPUT: Array of Chunks                                     │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  chunks = [                                         │       │
│  │    "BAB I KETENTUAN UMUM\n\nPasal 1\nDalam...",    │       │
│  │    "...pendidikan di Perguruan Tinggi.\n\nPasal 2 │       │
│  │     Dosen adalah pendidik profesional...",         │       │
│  │    "...profesional.\n\nPasal 3\nMahasiswa...",     │       │
│  │    // ... 60 chunks total                          │       │
│  │  ]                                                  │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📍 Kode: Endpoint Upload PDF

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 637-705

```javascript
app.post("/ingest", async (req, reply) => {
  // 1. Terima file PDF
  const data = await req.file();
  const buffer = await data.toBuffer();
  
  // 2. Parse PDF → Extract text
  const pdfData = await pdfParse(buffer);
  const fullText = pdfData.text;
  
  console.log(`PDF parsed: ${fullText.length} karakter`);
  
  // 3. Chunk text dengan smart chunking
  const chunks = chunkText(fullText, maxChars, overlap);
  
  console.log(`Created ${chunks.length} chunks`);
  
  // 4. Embed setiap chunk
  for (let idx = 0; idx < chunks.length; idx++) {
    const vec = await embedWithOllama(chunks[idx]);
    points.push({
      id: batchId + idx,
      vector: vec,
      payload: { 
        source_file: sourceFile, 
        text: chunks[idx] 
      },
    });
  }
  
  // 5. Simpan ke Qdrant
  await qdrant.upsert(COLLECTION_NAME, { points });
  
  return { 
    message: "PDF successfully ingested",
    chunks: chunks.length 
  };
});
```

---

## 📍 Kode: Fungsi chunkText (Smart Chunking)

**📍 Baris:** 81-156

```javascript
function chunkText(text, maxChars = 800, overlap = 150) {
  // 1. CLEANING: Bersihkan teks
  const cleaned = String(text || "")
    .replace(/\r/g, "")              // Hapus carriage return
    .replace(/\n{3,}/g, "\n\n")      // Max 2 newline berturut
    .trim();

  // 2. SPLIT: Pecah per paragraf
  const paragraphs = cleaned.split(/\n\n+/);

  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    // 3. HEADING DETECTION: Deteksi section baru
    const isNewSection = /^(BAB|BAGIAN|PASAL|ARTIKEL)/i.test(para.trim());

    // 4. Jika heading baru → simpan chunk sebelumnya, mulai baru
    if (isNewSection && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    // 5. Jika melebihi maxChars → simpan dan buat overlap
    if (currentChunk.length + para.length > maxChars) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());

        // OVERLAP: Ambil 2 kalimat terakhir untuk konteks
        const sentences = currentChunk.split(/(?<=[.!?])\s+/);
        const overlapText = sentences.slice(-2).join(" ");
        currentChunk = overlapText + "\n\n";
      }
    }

    currentChunk += para + "\n\n";
  }

  // 6. Simpan chunk terakhir
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // 7. Filter chunk terlalu pendek (< 50 karakter)
  return chunks.filter(c => c.length >= 50);
}
```

---

## 🔍 Fitur Smart Chunking

### 1. Paragraph-Aware Splitting

**Tidak potong sembarang:**
```
❌ BURUK (potong per 800 karakter):
"Syarat yudisium adalah lulus semua mata kuli" ← TERPOTONG!
"ah wajib dengan IPK minimal 2.00"

✅ BAGUS (potong per paragraf):
"Syarat yudisium adalah lulus semua mata kuliah 
wajib dengan IPK minimal 2.00"
```

---

### 2. Heading Detection

**Deteksi section baru:**
```javascript
const isNewSection = /^(BAB|BAGIAN|PASAL|ARTIKEL)/i.test(para);
```

**Contoh:**
```
Chunk 1: "BAB I KETENTUAN UMUM
         Pasal 1
         Dalam peraturan ini..."

── PEMISAHAN karena heading BAB II ──

Chunk 2: "BAB II SYARAT YUDISIUM
         Pasal 5
         Syarat yudisium adalah..."
```

---

### 3. Overlap untuk Konteks

**Masalah tanpa overlap:**
```
Chunk 1: "...mahasiswa harus lulus semua mata kuliah."
Chunk 2: "IPK minimal adalah 2.00 untuk yudisium."  ← Konteks hilang!
```

**Dengan overlap (2 kalimat terakhir diulang):**
```
Chunk 1: "...mahasiswa harus lulus semua mata kuliah."
Chunk 2: "...harus lulus semua mata kuliah. IPK minimal adalah 2.00..."
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
          OVERLAP - konteks tidak hilang!
```

---

### 4. Minimum Length Filter

```javascript
return chunks.filter(c => c.length >= 50);
```

**Kenapa?** Chunk terlalu pendek tidak bermakna:
- "Pasal 1" saja → tidak informatif
- "Lihat lampiran" → tidak berguna untuk retrieval

---

## 📊 Contoh Hasil Chunking

**Input PDF (3 halaman):**
```
BAB I KETENTUAN UMUM

Pasal 1
Dalam peraturan ini yang dimaksud dengan mahasiswa adalah peserta didik 
yang terdaftar dan menempuh pendidikan di Perguruan Tinggi.

Pasal 2
Dosen adalah pendidik profesional dan ilmuwan dengan tugas utama 
mentransformasikan, mengembangkan, dan menyebarluaskan ilmu pengetahuan.

BAB II SYARAT YUDISIUM

Pasal 3
Syarat yudisium adalah sebagai berikut:
1. Lulus semua mata kuliah wajib
2. IPK minimal 2.00
3. Tidak memiliki nilai E dalam transkrip
```

**Output Chunks:**
```
Chunk 1 (356 karakter):
"BAB I KETENTUAN UMUM

Pasal 1
Dalam peraturan ini yang dimaksud dengan mahasiswa adalah peserta didik 
yang terdaftar dan menempuh pendidikan di Perguruan Tinggi.

Pasal 2
Dosen adalah pendidik profesional dan ilmuwan dengan tugas utama 
mentransformasikan, mengembangkan, dan menyebarluaskan ilmu pengetahuan."

Chunk 2 (298 karakter):
"...menyebarluaskan ilmu pengetahuan.  ← OVERLAP

BAB II SYARAT YUDISIUM

Pasal 3
Syarat yudisium adalah sebagai berikut:
1. Lulus semua mata kuliah wajib
2. IPK minimal 2.00
3. Tidak memiliki nilai E dalam transkrip"
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, proses chunking PDF saya seperti ini:"**

1. **"User upload PDF"**
   - Diterima di endpoint `/ingest` (baris 637)
   - Parse dengan library `pdf-parse`

2. **"Teks di-extract"** (baris 674)
   - `pdfData.text` → dapat semua teks

3. **"Smart Chunking"** (baris 81-156)
   - Split per paragraf, bukan per karakter
   - Deteksi heading BAB/Pasal
   - Max 800 karakter per chunk
   - Overlap 150 karakter

4. **"Setiap chunk di-embed dan disimpan"** (baris 686-695)
   - `embedWithOllama(chunk)` → vektor
   - `qdrant.upsert()` → simpan ke database

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan alur PDF → chunks
- [ ] Bisa jelaskan kenapa split per paragraf
- [ ] Bisa jelaskan heading detection
- [ ] Bisa jelaskan overlap dan fungsinya
- [ ] Bisa tunjukkan kode chunkText (baris 81-156)
