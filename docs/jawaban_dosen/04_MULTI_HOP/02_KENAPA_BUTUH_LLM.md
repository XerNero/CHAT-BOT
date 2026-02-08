# Pertanyaan 13: Kenapa Multi-hop Butuh LLM?

## Pertanyaan Dosen
> "Multi-hop itu pakai LLM untuk apa? Kenapa butuh LLM di multi-hop?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, Multi-hop butuh LLM untuk 2 hal:**
1. **Query Decomposition** - LLM memecah pertanyaan jadi 4 sub-query
2. **Answer Synthesis** - LLM menggabungkan hasil retrieval jadi 1 jawaban

**Tanpa LLM, kita tidak bisa memecah pertanyaan kompleks secara cerdas."**

---

## 📖 Penjelasan Detail

### Kenapa Perlu Decomposition?

**Masalah Single-hop:**
```
User: "Jelaskan proses yudisium lengkap dari syarat sampai wisuda"

Single-hop cari 1x:
- Mungkin dapat chunk tentang "syarat"
- Tapi tidak dapat chunk tentang "prosedur" atau "wisuda"

Jawaban tidak lengkap!
```

**Solusi Multi-hop:**
```
LLM pecah jadi 4 pencarian:
1. "Apa syarat yudisium?" → dapat chunk syarat
2. "Apa prosedur yudisium?" → dapat chunk prosedur
3. "Apa aturan yudisium?" → dapat chunk aturan
4. "Apa yang terjadi setelah yudisium?" → dapat chunk wisuda

Jawaban LENGKAP!
```

---

### LLM di Multi-hop: 2 Peran

```
┌─────────────────────────────────────────────────────────────────┐
│                LLM ROLES IN MULTI-HOP                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ROLE 1: QUERY DECOMPOSITION                                    │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                      │       │
│  │  Input: "Jelaskan proses yudisium lengkap"          │       │
│  │                     │                                │       │
│  │                     ▼                                │       │
│  │              ┌──────────┐                           │       │
│  │              │   LLM    │ ← Generate 4 sub-query    │       │
│  │              └──────────┘                           │       │
│  │                     │                                │       │
│  │                     ▼                                │       │
│  │  Output: {                                          │       │
│  │    overview: "Apa definisi yudisium?",             │       │
│  │    detail: "Apa syarat yudisium?",                 │       │
│  │    aturan: "Apa batasan yudisium?",                │       │
│  │    penutup: "Apa tindak lanjut setelah yudisium?" │       │
│  │  }                                                  │       │
│  │                                                      │       │
│  └─────────────────────────────────────────────────────┘       │
│                          │                                      │
│                          ▼                                      │
│               (4x Hybrid Retrieval)                             │
│                          │                                      │
│                          ▼                                      │
│  ROLE 2: ANSWER SYNTHESIS                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                      │       │
│  │  Input: 16 chunks (4 per sub-query)                 │       │
│  │                     │                                │       │
│  │                     ▼                                │       │
│  │              ┌──────────┐                           │       │
│  │              │   LLM    │ ← Synthesize all chunks   │       │
│  │              └──────────┘                           │       │
│  │                     │                                │       │
│  │                     ▼                                │       │
│  │  Output: "Proses yudisium meliputi:                │       │
│  │          1. Syarat: ... [#1]                        │       │
│  │          2. Prosedur: ... [#5]                      │       │
│  │          3. Setelah lulus: ... [#12]"              │       │
│  │                                                      │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Kode: Query Decomposition

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 491-543

```javascript
async function decomposeQuery(question) {
  // Prompt untuk LLM
  const decomposePrompt = `Kamu adalah sistem pemecah pertanyaan untuk pencarian dokumen.
Ubah pertanyaan pengguna menjadi 4 sub-pertanyaan pencarian:
1) overview/definisi
2) detail/poin utama/langkah
3) batasan/syarat/pengecualian (aturan)
4) closure/tindak lanjut (penutup)

ATURAN:
- Output HARUS JSON valid dengan kunci: "overview","detail","aturan","penutup"
- Tiap nilai adalah 1 kalimat tanya, bahasa Indonesia

Pertanyaan pengguna:
${question}`;

  // Kirim ke LLM
  const { body } = await request(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: decomposePrompt }],
      options: { temperature: 0.1 },  // Low = konsisten
    }),
  });

  // Parse output JSON
  const parsed = safeJsonParse(json?.message?.content);
  return parsed;
}
```

---

### Kenapa Harus LLM untuk Decomposition?

**Tidak bisa pakai rule-based:**
```
Pertanyaan beragam:
- "Jelaskan yudisium" → LLM tahu pecah jadi definisi, syarat, dll
- "Bagaimana cara cuti?" → LLM tahu pecah jadi syarat cuti, prosedur, dll
- "Apa sanksi plagiarisme?" → LLM tahu pecah jadi definisi, jenis sanksi, dll

Rule-based tidak bisa handle semua variasi ini!
```

**LLM bisa:**
- Memahami **intent** pertanyaan
- Generate sub-query yang **relevan** dengan topik
- Adaptif untuk **berbagai jenis pertanyaan**

---

### Kode: Answer Synthesis

**📍 Baris:** 907-920

```javascript
// Semua chunks dari 4 sub-query digabung
const contextText = allChunks
  .map((c, idx) => `[#${idx + 1}] (${c.hop})\n${c.text}`)
  .join("\n\n---\n\n");

// LLM synthesize jadi 1 jawaban
const userPrompt = `PERTANYAAN:\n${question}\n\nCONTEXT:\n${contextText}`;

const baseMessages = [
  { role: "system", content: system },
  { role: "user", content: userPrompt },
];

const chat1 = await ollamaChat(baseMessages, 0.2);
```

---

### Perbandingan: Single-hop vs Multi-hop

| Aspek | Single-hop | Multi-hop |
|-------|------------|-----------|
| Retrieval | 1x pencarian | 4x pencarian |
| LLM calls | 1 (generate) | 2 (decompose + generate) |
| Context | Terbatas | Lebih lengkap |
| Latency | Cepat (~2 detik) | Lebih lambat (~5 detik) |
| Akurasi | Bagus untuk pertanyaan simple | Bagus untuk pertanyaan kompleks |

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, Multi-hop butuh LLM untuk 2 hal:"**

1. **"Query Decomposition"** (baris 491-543)
   - LLM memahami pertanyaan user
   - Pecah jadi 4 sub-query: overview, detail, aturan, penutup
   - Tidak bisa pakai rule-based karena pertanyaan terlalu beragam

2. **"Answer Synthesis"** (baris 907-920)
   - LLM menerima 16 chunks dari 4 pencarian
   - Gabungkan jadi 1 jawaban yang koheren
   - Dengan sitasi [#N] untuk setiap fakta

**"Kenapa tidak bisa tanpa LLM untuk decomposition?"**
- Pertanyaan user sangat beragam
- LLM bisa memahami intent dan adaptif
- Rule-based tidak fleksibel

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan 2 peran LLM di multi-hop
- [ ] Bisa jelaskan kenapa decomposition perlu LLM
- [ ] Bisa tunjukkan kode decomposition (baris 491-543)
- [ ] Bisa tunjukkan kode synthesis (baris 907-920)
