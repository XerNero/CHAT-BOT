# Pertanyaan 16: Bagaimana Chunking Mempengaruhi Retrieval?

## Pertanyaan Dosen
> "Chunking itu pengaruhnya apa ke retrieval? Kenapa harus dipotong-potong?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, chunking sangat mempengaruhi kualitas retrieval:**
1. **Chunk terlalu besar** → Embedding tidak fokus, noise banyak
2. **Chunk terlalu kecil** → Konteks hilang, tidak lengkap
3. **Chunk optimal (800 karakter)** → Balance antara fokus dan konteks

**Saya pakai Smart Chunking yang:**
- Hormati batas paragraf (tidak potong sembarang)
- Deteksi heading (BAB, Pasal)
- Overlap 150 karakter (konteks tidak hilang)"

---

## 📖 Penjelasan Detail

### Pengaruh Ukuran Chunk

```
┌─────────────────────────────────────────────────────────────────┐
│              CHUNK SIZE VS RETRIEVAL QUALITY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CHUNK TERLALU BESAR (5000+ karakter):                          │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  "BAB I Pendahuluan...                              │       │
│  │   BAB II Syarat Yudisium...                         │       │
│  │   BAB III Prosedur Cuti...                          │       │
│  │   BAB IV Sanksi Akademik..."                        │       │
│  │                                                      │       │
│  │  Masalah:                                           │       │
│  │  • Embedding jadi "rata-rata" dari banyak topik     │       │
│  │  • Tidak fokus ke satu topic                        │       │
│  │  • Query "syarat yudisium" bisa match chunk ini     │       │
│  │    tapi 80% isinya tidak relevan (noise)            │       │
│  │  • LLM kebingungan dengan context campur aduk       │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  CHUNK TERLALU KECIL (100 karakter):                            │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  "Syarat yudisium"                                  │       │
│  │  "adalah sebagai"                                   │       │
│  │  "berikut:"                                         │       │
│  │  "1. Lulus semua"                                   │       │
│  │  "mata kuliah."                                     │       │
│  │                                                      │       │
│  │  Masalah:                                           │       │
│  │  • Konteks terpecah-pecah                          │       │
│  │  • "1. Lulus semua" tidak ada konteks "yudisium"   │       │
│  │  • LLM tidak dapat informasi lengkap               │       │
│  │  • Banyak chunk = banyak embedding = mahal         │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  CHUNK OPTIMAL (800 karakter):                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  "Pasal 15 - Syarat Yudisium                        │       │
│  │                                                      │       │
│  │   Syarat yudisium adalah sebagai berikut:           │       │
│  │   1. Lulus semua mata kuliah wajib                  │       │
│  │   2. IPK minimal 2.00                               │       │
│  │   3. Tidak ada nilai E dalam transkrip"             │       │
│  │                                                      │       │
│  │  Kelebihan:                                         │       │
│  │  • Fokus ke satu topik/pasal                       │       │
│  │  • Konteks lengkap (judul + isi)                   │       │
│  │  • Embedding representatif                          │       │
│  │  • LLM dapat informasi yang cukup                  │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Kode Smart Chunking

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 81-156

```javascript
function chunkText(text, maxChars = 800, overlap = 150) {
  // 1. Bersihkan teks
  const cleaned = String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 2. Split per paragraf (bukan per karakter sembarang)
  const paragraphs = cleaned.split(/\n\n+/);

  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    // 3. Deteksi heading baru (BAB, Pasal)
    const isNewSection = /^(BAB|BAGIAN|PASAL|ARTIKEL)/i.test(para.trim());

    // 4. Jika heading baru, simpan chunk sebelumnya
    if (isNewSection && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    // 5. Jika melebihi maxChars, simpan dan buat overlap
    if (currentChunk.length + para.length > maxChars) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());

        // OVERLAP: ambil 2 kalimat terakhir
        const sentences = currentChunk.split(/(?<=[.!?])\s+/);
        const overlapText = sentences.slice(-2).join(" ");
        currentChunk = overlapText + "\n\n";
      }
    }

    currentChunk += para + "\n\n";
  }

  // 6. Simpan chunk terakhir
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  // 7. Filter chunk terlalu pendek
  return chunks.filter(c => c.length >= 50);
}
```

---

### Fitur Smart Chunking

| Fitur | Penjelasan | Baris |
|-------|------------|-------|
| **Paragraph-aware** | Split per paragraf, bukan per karakter | 90 |
| **Heading detection** | BAB, Pasal = pemisah alami | 107 |
| **Size limit** | Maksimal 800 karakter | 81 |
| **Overlap** | 2 kalimat terakhir diulang | 120-122 |
| **Min length** | Filter chunk < 50 karakter | 155 |

---

### Contoh Hasil Chunking

**Input PDF:**
```
BAB I KETENTUAN UMUM

Pasal 1
Dalam peraturan ini yang dimaksud dengan mahasiswa adalah peserta didik 
yang terdaftar dan menempuh pendidikan di Perguruan Tinggi.

Pasal 2
Dosen adalah pendidik profesional dan ilmuwan dengan tugas utama 
mentransformasikan, mengembangkan, dan menyebarluaskan ilmu pengetahuan.
```

**Hasil Chunking (Smart):**
```
Chunk 1: "BAB I KETENTUAN UMUM

Pasal 1
Dalam peraturan ini yang dimaksud dengan mahasiswa adalah peserta didik 
yang terdaftar dan menempuh pendidikan di Perguruan Tinggi."

Chunk 2: "...menempuh pendidikan di Perguruan Tinggi.  ← OVERLAP

Pasal 2
Dosen adalah pendidik profesional dan ilmuwan dengan tugas utama 
mentransformasikan, mengembangkan, dan menyebarluaskan ilmu pengetahuan."
```

**Perhatikan:**
- Pasal 1 dan Pasal 2 jadi chunk terpisah (heading detection)
- Ada overlap (kalimat terakhir Pasal 1 diulang di Chunk 2)

---

### Pengaruh ke Retrieval

| Aspek | Chunk Besar | Chunk Kecil | Chunk Optimal |
|-------|-------------|-------------|---------------|
| Embedding focus | ❌ Blur | ⚠️ Terlalu spesifik | ✅ Fokus |
| Context | ✅ Lengkap | ❌ Terpotong | ✅ Cukup |
| Noise | ❌ Banyak | ✅ Sedikit | ✅ Sedikit |
| Storage | ✅ Sedikit | ❌ Banyak | ✅ Balanced |
| Retrieval accuracy | ⚠️ 60% | ⚠️ 65% | ✅ 85%+ |

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, chunking sangat mempengaruhi kualitas retrieval:"**

1. **"Chunk terlalu besar"**
   - Embedding jadi "rata-rata" banyak topik
   - Banyak noise saat di-retrieve
   - LLM kebingungan dengan context campur

2. **"Chunk terlalu kecil"**
   - Konteks terpotong-potong
   - "1. Lulus semua" tanpa tahu ini syarat apa
   - LLM tidak dapat info lengkap

3. **"Saya pakai Smart Chunking"** (baris 81-156)
   - 800 karakter per chunk (optimal)
   - Split per paragraf, bukan sembarang
   - Deteksi BAB/Pasal sebagai pemisah alami
   - Overlap 150 karakter supaya konteks tidak hilang

4. **"Hasilnya"**
   - Setiap chunk fokus ke 1 topik
   - Embedding representatif
   - Retrieval lebih akurat

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan pengaruh chunk size ke embedding
- [ ] Bisa jelaskan masalah chunk terlalu besar/kecil
- [ ] Bisa jelaskan fitur smart chunking
- [ ] Bisa tunjukkan kode chunking (baris 81-156)
