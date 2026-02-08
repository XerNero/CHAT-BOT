# Pertanyaan 9: Kenapa LLM Bisa Halusinasi?

## Pertanyaan Dosen
> "Kenapa LLM bisa halusinasi? Dari mana datangnya informasi palsu itu?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, LLM halusinasi karena:**
1. **Probabilistik** - LLM cuma prediksi kata berikutnya yang 'paling mungkin', bukan yang 'paling benar'
2. **Tidak punya akses data real-time** - Training data sudah outdated
3. **Overgeneralization** - Model mengeneralisasi pola yang salah
4. **Tidak punya 'ground truth'** - Model tidak tahu mana fakta mana fiksi

**RAG mengatasi ini dengan memberikan CONTEXT dari dokumen asli."**

---

## 📖 Penjelasan Detail

### Apa Itu Halusinasi LLM?

**Halusinasi = LLM menghasilkan informasi yang terlihat meyakinkan tapi SALAH**

**Contoh:**
```
User: "Siapa rektor Universitas XYZ tahun 2024?"
LLM: "Rektor Universitas XYZ tahun 2024 adalah Prof. Dr. Ahmad Suryadi."

(Padahal nama itu TIDAK ADA - LLM mengarangnya)
```

---

### Penyebab Halusinasi

#### 1. **Probabilistik, Bukan Faktual**

LLM hanya memprediksi token berikutnya yang **paling mungkin**, bukan yang **paling benar**.

```
Input: "Ibukota Indonesia adalah"

Model melihat pola:
- "Ibukota X adalah Y" sangat sering muncul
- Token berikutnya yang "mungkin": Jakarta (99%), Surabaya (0.5%), ...

Jawaban: "Jakarta" ← Kebetulan benar

Input: "Presiden pertama planet Mars adalah"

Model melihat pola:
- "Presiden pertama X adalah Y" → pola yang sama!
- Token berikutnya: generate nama yang "terdengar presiden"

Jawaban: "John Armstrong" ← HALUSINASI (tidak ada presiden Mars)
```

**Point:** LLM tidak "tahu" fakta. Dia hanya tahu **pola statistik**.

---

#### 2. **Training Data Outdated (Knowledge Cutoff)**

```
LLM llama3 di-training sampai ~2023

User: "Siapa juara Piala Dunia 2026?"
LLM: "Argentina/Brasil/Jerman..." ← HALUSINASI (tidak tahu masa depan)

User: "Apa peraturan akademik terbaru kampus?"
LLM: "Berdasarkan peraturan tahun..." ← Mungkin sudah berubah
```

---

#### 3. **Overgeneralization**

Model melihat pola dan over-apply ke situasi yang salah.

```
Training data:
- "Kucing adalah hewan berbulu."
- "Anjing adalah hewan berbulu."
- "Kelinci adalah hewan berbulu."

LLM belajar pola: "X adalah hewan berbulu"

User: "Apa itu ikan hiu?"
LLM: "Ikan hiu adalah hewan berbulu..." ← HALUSINASI

(Model over-apply pola "hewan = berbulu")
```

---

#### 4. **Tidak Bisa Membedakan Fakta vs Fiksi**

```
Training data mengandung:
- Wikipedia (fakta)
- Novel (fiksi)
- Forum (opini)
- Berita palsu (hoax)

LLM tidak tahu mana yang benar!

User: "Apakah bumi datar?"
LLM: "Menurut beberapa teori..." ← Bisa menjawab berdasarkan konten flat-earth
```

---

#### 5. **Pressure to Answer**

LLM di-training untuk selalu memberikan jawaban, bukan mengatakan "tidak tahu".

```
User: "Berapa nomor telepon rumah saya?"
LLM: "Nomor telepon Anda adalah 0812-3456-7890" ← HALUSINASI

(LLM tidak bisa bilang "saya tidak tahu")
```

---

### Bagaimana RAG Mengatasi Halusinasi

```
┌─────────────────────────────────────────────────────────────────┐
│              TANPA RAG vs DENGAN RAG                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TANPA RAG:                                                     │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ User: "Apa syarat yudisium?"                         │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │         ┌─────────┐                                 │       │
│  │         │   LLM   │ ← Hanya andalkan training data  │       │
│  │         └────┬────┘                                 │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │ LLM: "Syarat yudisium adalah..." ← Mungkin HALUSINASI│       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  DENGAN RAG:                                                    │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ User: "Apa syarat yudisium?"                         │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │     ┌─────────────────┐                             │       │
│  │     │ RETRIEVAL (RAG) │ ← Cari di dokumen           │       │
│  │     └────────┬────────┘                             │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │     ┌─────────────────┐                             │       │
│  │     │ CONTEXT CHUNKS  │                             │       │
│  │     │ "Pasal 15:      │                             │       │
│  │     │  Syarat yudisium│ ← Dokumen ASLI             │       │
│  │     │  adalah..."     │                             │       │
│  │     └────────┬────────┘                             │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │         ┌─────────┐                                 │       │
│  │         │   LLM   │ ← Jawab BERDASARKAN context    │       │
│  │         └────┬────┘                                 │       │
│  │              │                                       │       │
│  │              ▼                                       │       │
│  │ LLM: "Berdasarkan Pasal 15..." ← FAKTUAL + SITASI  │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Kode Anti-Halusinasi Kita

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 733-748

```javascript
const system = `Kamu adalah asisten kampus berbasis dokumen.

ATURAN KONTEN:
- Jawaban HANYA berdasarkan CONTEXT yang diberikan.  ← Anti-halusinasi
- Jika tidak ada bukti di CONTEXT, tulis: "Tidak ditemukan informasi yang relevan di dokumen."  ← Fallback
- WAJIB pakai sitasi [#N] di akhir setiap fakta/kalimat penting.  ← Traceability
`;
```

**Mekanisme:**
1. **System prompt ketat** → LLM dilarang jawab di luar context
2. **Wajib sitasi** → Setiap fakta harus ada referensi
3. **Fallback "tidak ditemukan"** → Lebih baik jujur daripada halusinasi

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, LLM bisa halusinasi karena:"**

1. **"Dia cuma prediksi kata yang 'mungkin', bukan yang 'benar'"**
   - LLM tidak tahu fakta
   - Dia tahu pola statistik dari training data

2. **"Training data sudah lama"**
   - llama3 di-training sampai 2023
   - Tidak tahu peraturan kampus terbaru

3. **"Tidak bisa bedakan fakta vs fiksi"**
   - Training data campur: Wikipedia, novel, hoax
   - Semua diperlakukan sama

4. **"RAG mengatasi ini dengan:"**
   - Memberikan context dari dokumen ASLI
   - System prompt yang ketat
   - Wajib sitasi untuk setiap fakta
   - Fallback "tidak ditemukan" jika tidak ada info

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan 5 penyebab halusinasi
- [ ] Bisa beri contoh halusinasi LLM
- [ ] Bisa jelaskan bagaimana RAG mengatasi
- [ ] Bisa tunjukkan kode anti-halusinasi (baris 733-748)
