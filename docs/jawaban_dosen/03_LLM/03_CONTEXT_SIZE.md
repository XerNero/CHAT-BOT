# Pertanyaan 17: Bagaimana Context Size Mempengaruhi Jawaban LLM?

## Pertanyaan Dosen
> "Context yang dikirim ke LLM itu pengaruhnya bagaimana ke jawaban?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, context size sangat mempengaruhi kualitas jawaban:**
1. **Context terlalu sedikit** → Jawaban tidak lengkap/tidak akurat
2. **Context terlalu banyak** → LLM bingung, 'lost in the middle' problem
3. **Context optimal** → Jawaban lengkap dan fokus

**Saya limit:**
- Single-hop: 8 chunks
- Multi-hop: 4×4 = 16 chunks (maksimal ~10-12 setelah deduplicate)"

---

## 📖 Penjelasan Detail

### Context Window LLM

**Context Window = Jumlah token yang bisa diproses LLM sekaligus**

| Model | Context Window | Setara |
|-------|----------------|--------|
| llama3:8b | ~8,000 tokens | ~6,000 kata |
| GPT-4-Turbo | 128,000 tokens | ~100,000 kata |
| Claude 3 | 200,000 tokens | ~150,000 kata |

**Masalah:** Meski context window besar, tidak berarti harus diisi penuh!

---

### Lost in the Middle Problem

**Research menunjukkan:** LLM cenderung "lupa" informasi di tengah context panjang.

```
Context: [Chunk 1] [Chunk 2] [Chunk 3] ... [Chunk 15] [Chunk 16]
              ↑                              ↓              ↑
           Ingat baik                    DILUPAKAN      Ingat baik

Fenomena: LLM lebih ingat awal dan akhir context,
          tapi sering "lupa" bagian tengah.
```

---

### Kode: Limit Context

**📁 File:** `apps/api/server.mjs`

**Single-hop (baris 721):**
```javascript
// Limit 8 chunks untuk single-hop
const contextChunks = await hybridRetrieve(question, 8);
```

**Multi-hop (baris 835-838):**
```javascript
// 4 chunks per sub-query × 4 sub-query = 16 max
const [overviewChunks, detailChunks, aturanChunks, penutupChunks] = await Promise.all([
  hybridRetrieve(subQueries.overview, 4),
  hybridRetrieve(subQueries.detail, 4),
  hybridRetrieve(subQueries.aturan, 4),
  hybridRetrieve(subQueries.penutup, 4),
]);

// Deduplicate → biasanya jadi 10-12 unique chunks
```

---

### Diagram: Context Size Effect

```
┌─────────────────────────────────────────────────────────────────┐
│                CONTEXT SIZE VS ANSWER QUALITY                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONTEXT TERLALU SEDIKIT (1-2 chunks):                          │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Context: "Syarat yudisium adalah lulus semua MK"   │       │
│  │                                                      │       │
│  │  User: "Jelaskan syarat yudisium lengkap"           │       │
│  │  LLM: "Syarat yudisium adalah lulus semua MK."      │       │
│  │                                                      │       │
│  │  Problem: Tidak ada info tentang IPK, nilai E, dll  │       │
│  │           Jawaban TIDAK LENGKAP                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  CONTEXT OPTIMAL (6-10 chunks):                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Context:                                            │       │
│  │  [#1] "Syarat yudisium adalah lulus semua MK"       │       │
│  │  [#2] "IPK minimal 2.00 untuk yudisium"             │       │
│  │  [#3] "Tidak boleh ada nilai E dalam transkrip"     │       │
│  │  [#4] "Mahasiswa harus sudah sidang skripsi"        │       │
│  │                                                      │       │
│  │  User: "Jelaskan syarat yudisium lengkap"           │       │
│  │  LLM: "Syarat yudisium meliputi:                    │       │
│  │        1. Lulus semua MK [#1]                       │       │
│  │        2. IPK minimal 2.00 [#2]                     │       │
│  │        3. Tidak ada nilai E [#3]                    │       │
│  │        4. Sudah sidang skripsi [#4]"                │       │
│  │                                                      │       │
│  │  ✅ Jawaban LENGKAP dengan sitasi                   │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  CONTEXT TERLALU BANYAK (30+ chunks):                           │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Context: 30 chunks bercampur                       │       │
│  │  [#1] Syarat yudisium...                            │       │
│  │  [#2] Prosedur cuti...           ← Tidak relevan    │       │
│  │  [#3] Sanksi akademik...         ← Tidak relevan    │       │
│  │  [#4] IPK yudisium...                               │       │
│  │  ...                                                │       │
│  │  [#28] Biaya kuliah...           ← Tidak relevan    │       │
│  │  [#29] Jadwal ujian...           ← Tidak relevan    │       │
│  │  [#30] Nilai E yudisium...                          │       │
│  │                                                      │       │
│  │  Problems:                                          │       │
│  │  • LLM bingung dengan banyak info tidak relevan    │       │
│  │  • "Lost in the middle" → info di tengah dilupakan │       │
│  │  • Token mahal, latency tinggi                      │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Kode: Format Context

**📍 Baris:** 723-727 (single-hop), 873-875 (multi-hop)

```javascript
// Format context dengan sitasi
const contextText = contextChunks
  .map((c, idx) => `[#${idx + 1}]\n${c.text}`)
  .join("\n\n---\n\n");

// Contoh output:
// [#1]
// Syarat yudisium adalah lulus semua mata kuliah wajib.
//
// ---
//
// [#2]
// IPK minimal untuk yudisium adalah 2.00.
```

---

### Strategi Optimasi

| Strategi | Implementasi | Baris |
|----------|-------------|-------|
| **Limit top-K** | Hanya ambil 8 chunks | 721 |
| **Multi-hop spread** | 4 chunks × 4 aspek | 835-838 |
| **Deduplicate** | Hapus chunk duplikat | 841-855 |
| **Quality over quantity** | RRF ranking | 466-467 |

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, context size mempengaruhi jawaban seperti ini:"**

1. **"Context terlalu sedikit"**
   - LLM tidak punya cukup informasi
   - Jawaban tidak lengkap

2. **"Context terlalu banyak"**
   - LLM bingung, noise tinggi
   - "Lost in the middle" problem
   - Token mahal, latency tinggi

3. **"Saya limit optimal"** (baris 721, 835-838)
   - Single-hop: 8 chunks
   - Multi-hop: 4×4 (deduplicate jadi ~10-12)
   - Cukup untuk jawaban lengkap, tidak terlalu banyak

4. **"Kualitas > Kuantitas"**
   - Lebih baik 8 chunk relevan
   - Daripada 30 chunk yang campur-campur

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan context window
- [ ] Bisa jelaskan "lost in the middle" problem
- [ ] Bisa jelaskan strategi limit context
- [ ] Bisa tunjukkan kode limit (baris 721, 835-838)
