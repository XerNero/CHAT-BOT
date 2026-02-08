# Pertanyaan 5: Bagaimana Multi-hop Bekerja? Dari Mana 4 Sub-Query?

## Pertanyaan Dosen
> "Nah ini bagaimana caranya multihopnya? Dari mana 4 ini ada? Makanya dia mendekati ya... dari 4 ini nanti dia tuh bakal milih berdasarkan rank jawabannya yang mana yang lebih akurat."

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, Multi-hop RAG bekerja dengan MEMECAH pertanyaan jadi 4 sub-query:**
1. **Overview** - Definisi/gambaran umum
2. **Detail** - Langkah/poin utama
3. **Aturan** - Syarat/batasan
4. **Penutup** - Kesimpulan/tindak lanjut

**Setiap sub-query dicarikan chunks-nya (pakai Hybrid Retrieval), lalu digabung dan di-synthesize jadi 1 jawaban lengkap."**

---

## 📖 Penjelasan Detail untuk Dosen

### Apa Itu Multi-hop RAG?

**Single-hop vs Multi-hop:**

| Single-hop | Multi-hop |
|------------|-----------|
| 1 pertanyaan → 1 pencarian → jawaban | 1 pertanyaan → 4 pencarian → jawaban |
| Cocok untuk pertanyaan sederhana | Cocok untuk pertanyaan kompleks |
| Konteks terbatas | Konteks lebih lengkap |

**Analogi:**
- **Single-hop**: Tanya 1 orang ahli
- **Multi-hop**: Tanya 4 ahli bidang berbeda, gabungkan jawabannya

---

### Langkah 1: Terima Pertanyaan

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 823-830  
**📋 Endpoint:** `POST /chat-multihop`

```javascript
app.post("/chat-multihop", async (req, reply) => {
  const body = req.body || {};
  const question = String(body.question || "").trim();  // "Apa syarat yudisium?"
  const history = Array.isArray(body.history) ? body.history : [];

  if (!question) return reply.code(400).send({ ok: false, message: "question is required" });
  
  // Pastikan cache BM25 sudah dimuat
  if (!keywordCache.points.length) await loadKeywordCache();

  // ... lanjut ke decomposition
});
```

---

### Langkah 2: Query Decomposition (Pecah Pertanyaan)

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 491-543  
**📋 Fungsi:** `decomposeQuery()`

```javascript
async function decomposeQuery(question) {
  // 1. Buat prompt untuk LLM
  const decomposePrompt = `Kamu adalah sistem pemecah pertanyaan untuk pencarian dokumen.
Ubah pertanyaan pengguna menjadi 4 sub-pertanyaan pencarian:
1) overview/definisi
2) detail/poin utama/langkah
3) batasan/syarat/pengecualian (aturan)
4) closure/tindak lanjut (penutup)

ATURAN:
- Output HARUS JSON valid dengan kunci: "overview","detail","aturan","penutup"
- Tiap nilai adalah 1 kalimat tanya, bahasa Indonesia
- Jangan menambahkan fakta di luar pertanyaan pengguna

Pertanyaan pengguna:
${question}`;

  // 2. Kirim ke LLM (Ollama)
  const { body, statusCode } = await request(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,                                    // llama3:8b
      messages: [{ role: "user", content: decomposePrompt }],
      stream: false,
      options: { temperature: 0.1 },  // Low temperature = deterministik
    }),
  });

  // 3. Parse response JSON
  const json = await body.json();
  const content = json?.message?.content || "";
  const parsed = safeJsonParse(content);

  // 4. Validasi dan return
  if (parsed && parsed.overview && parsed.detail && parsed.aturan && parsed.penutup) {
    return {
      overview: String(parsed.overview).trim(),
      detail: String(parsed.detail).trim(),
      aturan: String(parsed.aturan).trim(),
      penutup: String(parsed.penutup).trim(),
    };
  }

  // 5. Fallback jika LLM tidak menghasilkan JSON valid
  return {
    overview: `Apa definisi dan konteks umum tentang: ${question}?`,
    detail: `Apa langkah-langkah atau poin utama terkait: ${question}?`,
    aturan: `Apa syarat, batasan, atau pengecualian terkait: ${question}?`,
    penutup: `Apa kesimpulan atau tindak lanjut terkait: ${question}?`,
  };
}
```

---

### Contoh Hasil Decomposition

**Input:** "Apa syarat yudisium?"

**Output dari LLM:**
```json
{
  "overview": "Apa definisi dan pengertian yudisium?",
  "detail": "Apa saja syarat-syarat yang harus dipenuhi untuk yudisium?",
  "aturan": "Apa batasan atau pengecualian terkait yudisium?",
  "penutup": "Bagaimana proses setelah mahasiswa memenuhi syarat yudisium?"
}
```

**Kenapa 4 sub-query?**
- **Overview**: Konteks umum, definisi
- **Detail**: Poin-poin spesifik
- **Aturan**: Syarat, batasan, pengecualian
- **Penutup**: Kesimpulan, langkah selanjutnya

---

### Langkah 3: Hybrid Retrieval untuk SETIAP Sub-Query

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 832-839

```javascript
// 1. Pecah pertanyaan jadi 4 sub-query
const subQueries = await decomposeQuery(question);

// 2. Jalankan Hybrid Retrieval untuk SETIAP sub-query (PARALLEL)
const [overviewChunks, detailChunks, aturanChunks, penutupChunks] = await Promise.all([
  hybridRetrieve(subQueries.overview, 4),   // 4 chunks untuk overview
  hybridRetrieve(subQueries.detail, 4),     // 4 chunks untuk detail
  hybridRetrieve(subQueries.aturan, 4),     // 4 chunks untuk aturan
  hybridRetrieve(subQueries.penutup, 4),    // 4 chunks untuk penutup
]);
```

**Penjelasan:**
- `Promise.all()` = jalankan 4 retrieval BERSAMAAN (parallel)
- Setiap retrieval menggunakan Hybrid (Vector + BM25 + RRF)
- Setiap sub-query mendapat maksimal 4 chunks

**Total chunks maksimal:** 4 × 4 = 16 chunks

---

### Langkah 4: Merge dan Deduplicate

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 841-855

```javascript
// 1. Set untuk tracking ID yang sudah diambil
const seenIds = new Set();
const allChunks = [];

// 2. Fungsi helper untuk menambahkan chunks
const add = (chunks, hop) => {
  for (const c of chunks) {
    // Hanya tambahkan jika belum ada (deduplicate)
    if (!seenIds.has(c.id)) {
      seenIds.add(c.id);
      allChunks.push({ ...c, hop });  // Tambahkan label hop
    }
  }
};

// 3. Gabungkan semua chunks dengan label
add(overviewChunks, "overview");
add(detailChunks, "detail");
add(aturanChunks, "aturan");
add(penutupChunks, "penutup");
```

**Penjelasan:**
- Chunk yang sama bisa muncul di beberapa sub-query
- Deduplicate: hanya ambil sekali
- Setiap chunk diberi label dari mana asalnya (hop)

---

### Langkah 5: Buat Context dengan Label

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 873-875

```javascript
// Format chunks dengan nomor sitasi dan label hop
const contextText = allChunks
  .map((c, idx) => `[#${idx + 1}] (${c.hop})\n${c.text}`)
  .join("\n\n---\n\n");
```

**Contoh Output:**
```
[#1] (overview)
Yudisium adalah proses pengesahan kelulusan mahasiswa yang telah menyelesaikan seluruh program studi.

---

[#2] (detail)
Syarat yudisium meliputi: 1) Lulus semua mata kuliah, 2) IPK minimal 2.00, 3) Tidak ada nilai E, 4) Sudah sidang skripsi.

---

[#3] (aturan)
Mahasiswa yang memiliki tunggakan administrasi tidak dapat mengikuti yudisium sampai tunggakan diselesaikan.

---

[#4] (penutup)
Setelah yudisium, mahasiswa akan menerima ijazah dan transkrip nilai dalam waktu 2-4 minggu.
```

---

### Langkah 6: System Prompt untuk Synthesis

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 877-905

```javascript
const system = `Kamu adalah asisten kampus berbasis dokumen.

ATURAN FORMAT JAWABAN:
- Gunakan **Markdown** untuk format yang rapi dan mudah dibaca.
- Gunakan heading (## atau ###) untuk judul bagian jika perlu.
- Gunakan numbered list (1. 2. 3.) untuk langkah-langkah.
- Gunakan bullet points (- atau *) untuk daftar item.
- Gunakan **bold** untuk istilah penting.

ATURAN KONTEN:
- Jawaban HANYA berdasarkan CONTEXT yang diberikan.
- Jika tidak ada bukti di CONTEXT, tulis: "Tidak ditemukan informasi..."
- Jangan menyebut "chatbot", "prompt", "instruksi", "konteks".
- WAJIB pakai sitasi [#N] di akhir setiap fakta/kalimat penting.
- Bahasa Indonesia.`;
```

---

### Langkah 7: Generate Jawaban dengan LLM

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 907-920

```javascript
// 1. Format user prompt
const userPrompt = `PERTANYAAN:\n${question}\n\nCONTEXT:\n${contextText}`;

// 2. Susun messages
const baseMessages = [
  { role: "system", content: system },                    // System prompt
  ...history.slice(-6).map((m) => ({ role: m.role, content: String(m.content || "") })),  // History
  { role: "user", content: userPrompt },                  // Pertanyaan + context
];

// 3. Generate jawaban
const chat1 = await ollamaChat(baseMessages, 0.2);
let raw = chat1?.message?.content || "";
let answer = finalizeAnswer(raw);  // Bersihkan dan format
```

---

### Langkah 8: Validasi dan Retry

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 922-937

```javascript
// Jika tidak ada sitasi, retry
if (!hasCitations(answer) && !isNotFoundText(answer)) {
  const repairMessages = [
    { role: "system", content: system },
    { role: "user", content: userPrompt },
    {
      role: "user",
      content: "Ulangi jawaban. PASTIKAN setiap fakta penting diakhiri sitasi [#N]."
    },
  ];
  const chat2 = await ollamaChat(repairMessages, 0.0);  // temperature 0 = deterministik
  raw = chat2?.message?.content || raw;
  answer = finalizeAnswer(raw);
}

// Fallback: tambahkan [#1] jika masih tidak ada sitasi
answer = ensureCitationsInText(answer, "[#1]");
```

---

### Langkah 9: Return Response

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 939-951

```javascript
return reply.send({
  ok: true,
  answer,                                      // Jawaban final
  sources: allChunks.map((c, i) => ({         // Daftar sumber
    ref: `#${i + 1}`,
    id: c.id,
    source_file: c.source_file,
    chunk_index: c.chunk_index,
    hop: c.hop,                                // Label: overview/detail/aturan/penutup
    fused_score: c.score,
  })),
  debug: { hopsFound, subQueries },           // Info debug
});
```

---

## 📊 Diagram Alur Lengkap Multi-hop

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-HOP RAG PIPELINE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT: "Apa syarat yudisium?"                                  │
│                      │                                           │
│                      ▼                                           │
│  ┌─────────────────────────────────────────┐                    │
│  │         STEP 1: DECOMPOSITION           │                    │
│  │         decomposeQuery()                │                    │
│  │         (Baris 491-543)                 │                    │
│  └─────────────────────────────────────────┘                    │
│                      │                                           │
│     ┌────────────────┼────────────────┬────────────────┐        │
│     ▼                ▼                ▼                ▼        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ OVERVIEW │  │  DETAIL  │  │  ATURAN  │  │ PENUTUP  │        │
│  │ "Apa     │  │ "Apa     │  │ "Apa     │  │ "Bagai-  │        │
│  │ definisi │  │ syarat-  │  │ batasan  │  │ mana     │        │
│  │ yudisium │  │ syarat   │  │ terkait  │  │ setelah  │        │
│  │ ?"       │  │ ?"       │  │ ?"       │  │ yudisium │        │
│  │          │  │          │  │          │  │ ?"       │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       ▼             ▼             ▼             ▼               │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              STEP 2: HYBRID RETRIEVAL              │        │
│  │              (4x parallel, masing-masing 4 chunks)  │        │
│  │              hybridRetrieve() - Baris 834-839      │        │
│  └─────────────────────────────────────────────────────┘        │
│       │             │             │             │               │
│       ▼             ▼             ▼             ▼               │
│    4 chunks      4 chunks      4 chunks      4 chunks          │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              STEP 3: MERGE & DEDUPLICATE           │        │
│  │              (Baris 841-855)                        │        │
│  │              Max 16 chunks → ~10-12 unique chunks   │        │
│  └─────────────────────────────────────────────────────┘        │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              STEP 4: BUILD CONTEXT                  │        │
│  │              [#1] (overview) ...                    │        │
│  │              [#2] (detail) ...                      │        │
│  │              (Baris 873-875)                        │        │
│  └─────────────────────────────────────────────────────┘        │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              STEP 5: LLM SYNTHESIS                  │        │
│  │              ollamaChat() + finalizeAnswer()        │        │
│  │              (Baris 907-937)                        │        │
│  └─────────────────────────────────────────────────────┘        │
│                           │                                      │
│                           ▼                                      │
│  OUTPUT:                                                         │
│  "### Syarat Yudisium                                           │
│                                                                  │
│   Yudisium adalah proses pengesahan kelulusan. [#1]             │
│                                                                  │
│   Syarat yang harus dipenuhi:                                   │
│   1. Lulus semua mata kuliah [#2]                               │
│   2. IPK minimal 2.00 [#2]                                       │
│   3. Tidak ada tunggakan [#3]                                   │
│                                                                  │
│   Setelah yudisium, ijazah akan diterbitkan. [#4]"              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, begini cara multi-hop saya bekerja:"**

1. **"Pertanyaan dipecah oleh LLM"** (baris 491-543)
   - 1 pertanyaan → 4 sub-query
   - Overview, Detail, Aturan, Penutup

2. **"Masing-masing sub-query dicarikan chunks"** (baris 834-839)
   - Pakai Hybrid Retrieval yang sama
   - 4 sub-query × 4 chunks = 16 chunks maksimal

3. **"Hasilnya digabung dan dideduplikasi"** (baris 841-855)
   - Chunk yang sama hanya diambil sekali
   - Diberi label dari mana asalnya

4. **"Semua chunks dikirim ke LLM untuk di-synthesize"** (baris 907-920)
   - LLM membuat 1 jawaban lengkap
   - Dengan sitasi [#N]

**"Kenapa 4 sub-query, Pak?"**
- Satu pertanyaan bisa punya banyak aspek
- Dengan memecah → dapat konteks lebih lengkap
- Jawaban jadi lebih komprehensif

**"Bedanya dengan Single-hop?"**
- Single-hop: 1 pencarian, konteks terbatas
- Multi-hop: 4 pencarian, konteks lebih kaya

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan beda single-hop vs multi-hop
- [ ] Bisa jelaskan 4 jenis sub-query dan fungsinya
- [ ] Bisa tunjukkan kode decomposition (baris 491-543)
- [ ] Bisa jelaskan proses parallel retrieval (baris 834-839)
- [ ] Bisa jelaskan proses merge & deduplicate
- [ ] Bisa jelaskan proses synthesis ke 1 jawaban
