                                             # Pertanyaan 11: Bagaimana RAG Mengatasi Knowledge Cutoff LLM?

## Pertanyaan Dosen
> "LLM kan punya batasan pengetahuan (knowledge cutoff). Bagaimana RAG mengatasi ini?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, LLM punya knowledge cutoff (batas waktu training data). Misalnya llama3 di-training sampai 2023, jadi tidak tahu informasi setelah itu.**

**RAG mengatasi ini dengan:**
1. **Menyediakan context dari dokumen terbaru** - kita upload PDF terbaru
2. **LLM jawab berdasarkan context** - bukan dari training data
3. **Data bisa di-update kapan saja** - tanpa re-training model"

---

## 📖 Penjelasan Detail

### Apa Itu Knowledge Cutoff?

**Knowledge Cutoff = Tanggal terakhir data training LLM**

| Model | Knowledge Cutoff | Artinya |
|-------|------------------|---------|
| GPT-4 | April 2023 | Tidak tahu event setelah April 2023 |
| llama3 | ~2023 | Tidak tahu peraturan kampus 2024 |
| Claude | Early 2024 | Relatif lebih baru |

**Contoh Masalah:**

```
User: "Apa peraturan yudisium terbaru kampus?"

LLM tanpa RAG:
"Berdasarkan pengetahuan saya tentang peraturan umum..." 
← Mungkin outdated atau halusinasi

User: "Siapa dekan fakultas saat ini?"

LLM tanpa RAG:
"Dekan fakultas adalah Prof. Dr. ..." 
← Mungkin sudah ganti, LLM tidak tahu
```

---

### Bagaimana RAG Mengatasi

```
┌─────────────────────────────────────────────────────────────────┐
│            KNOWLEDGE CUTOFF vs RAG SOLUTION                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TANPA RAG (Knowledge Cutoff Problem):                          │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                      │       │
│  │  LLM Training Data:                                 │       │
│  │  ├── Wikipedia 2023                                 │       │
│  │  ├── Books sampai 2023                              │       │
│  │  └── Internet data 2023                             │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │  ┌──────────────────────┐                           │       │
│  │  │   LLM "Brain"        │                           │       │
│  │  │   (Fixed knowledge)  │ ← Tidak bisa diupdate     │       │
│  │  └──────────────────────┘                           │       │
│  │              │                                       │       │
│  │  User: "Peraturan 2024?"                            │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │  LLM: "Tidak tahu" atau HALUSINASI                  │       │
│  │                                                      │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  DENGAN RAG (Solution):                                         │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                      │       │
│  │  External Knowledge (Qdrant DB):                    │       │
│  │  ├── peraturan_akademik_2024.pdf ← BARU!           │       │
│  │  ├── pedoman_yudisium_2024.pdf   ← BARU!           │       │
│  │  └── ... dokumen lain                               │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │  ┌──────────────────────┐                           │       │
│  │  │   RETRIEVAL (RAG)    │ ← Cari dokumen relevan   │       │
│  │  └──────────────────────┘                           │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │  ┌──────────────────────┐                           │       │
│  │  │   CONTEXT CHUNKS     │                           │       │
│  │  │   "Pasal 15 (2024):  │ ← Info TERBARU           │       │
│  │  │   Syarat yudisium..."│                           │       │
│  │  └──────────────────────┘                           │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │  ┌──────────────────────┐                           │       │
│  │  │   LLM + CONTEXT      │ ← Jawab dari context     │       │
│  │  └──────────────────────┘                           │       │
│  │              │                                       │       │
│  │  User: "Peraturan 2024?"                            │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │  LLM: "Berdasarkan Pasal 15 tahun 2024..." ← AKURAT│       │
│  │                                                      │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Implementasi di Kode Kita

**1. Upload Dokumen Baru (Kapan Saja)**

**📍 Baris:** 637-705 (endpoint `/ingest`)

```javascript
app.post("/ingest", async (req, reply) => {
  // User bisa upload PDF baru kapan saja
  const data = await req.file();
  
  // Proses: chunk → embed → simpan ke Qdrant
  const chunks = chunkText(fullText, maxChars, overlap);
  
  for (let idx = 0; idx < chunks.length; idx++) {
    const vec = await embedWithOllama(chunks[idx]);
    points.push({
      id: batchId + idx,
      vector: vec,
      payload: { source_file: sourceFile, text: chunks[idx] },
    });
  }
  
  await qdrant.upsert(COLLECTION_NAME, { points });
  // Sekarang dokumen baru bisa di-retrieve!
});
```

**2. LLM Jawab dari Context (Bukan Training Data)**

**📍 Baris:** 733-748

```javascript
const system = `Kamu adalah asisten kampus berbasis dokumen.

ATURAN KONTEN:
- Jawaban HANYA berdasarkan CONTEXT yang diberikan.  ← KEY!
- Jika tidak ada bukti di CONTEXT, tulis: "Tidak ditemukan..."
`;

// Context berisi data dari dokumen yang di-upload (bisa versi 2024)
const userPrompt = `PERTANYAAN:\n${question}\n\nCONTEXT:\n${contextText}`;
```

---

### Keuntungan RAG vs Re-training

| Aspek | Fine-tuning/Re-training | RAG |
|-------|------------------------|-----|
| Update pengetahuan | Perlu training ulang (mahal) | Upload dokumen baru (gratis) |
| Waktu update | Jam-hari | Menit |
| Biaya | $100-10,000 | ~$0 |
| Traceability | Tidak bisa cite sumber | Bisa sitasi [#N] |
| Privasi | Data masuk model | Data tetap lokal |

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, LLM punya knowledge cutoff seperti ini:"**

1. **"llama3 di-training sampai 2023"**
   - Tidak tahu peraturan kampus 2024
   - Tidak tahu dekan baru

2. **"RAG mengatasi dengan external knowledge"**
   - Kita upload PDF peraturan 2024
   - Disimpan di Qdrant database

3. **"Saat user bertanya, RAG cari di database dulu"**
   - Dapat chunk dari dokumen 2024
   - LLM jawab berdasarkan chunk ini

4. **"Keuntungannya:"**
   - Update gratis dan cepat (upload PDF baru)
   - Tidak perlu re-training model
   - Bisa cite sumber dengan [#N]

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan apa itu knowledge cutoff
- [ ] Bisa jelaskan kenapa ini masalah untuk chatbot kampus
- [ ] Bisa jelaskan bagaimana RAG mengatasi
- [ ] Bisa bandingkan dengan fine-tuning
