# Walkthrough - Chatbot RAG Project

Dokumen ini merangkum semua yang telah dicapai dalam pengembangan proyek Chatbot RAG.

---

## 📋 Ringkasan Proyek

Chatbot berbasis website yang menjawab pertanyaan pengguna **hanya berdasarkan isi file PDF** menggunakan teknologi **Hybrid RAG** (Retrieval-Augmented Generation) dengan dukungan **Multi-hop Query Decomposition**.

---

## ✅ Fitur yang Sudah Diimplementasi

### 1. Backend API (Fastify + Node.js)

| Endpoint | Fungsi | Status |
|----------|--------|--------|
| `GET /health` | Cek status Qdrant dan Ollama | ✅ |
| `POST /ingest` | Upload dan index PDF ke Qdrant | ✅ |
| `POST /chat` | Single-hop RAG dengan output 4 bagian | ✅ |
| `POST /chat-multihop` | Multi-hop RAG dengan Query Decomposition | ✅ |

### 2. Hybrid RAG

- **Vector Search**: Semantic search via Qdrant
- **BM25 Search**: Keyword search via Node.js (in-memory)
- **RRF Fusion**: Reciprocal Rank Fusion untuk menggabungkan hasil

### 3. Multi-hop Query Decomposition

Alur kerja:
1. **Decompose**: LLM memecah 1 pertanyaan → 4 sub-pertanyaan
   - Overview/definisi
   - Detail/langkah
   - Aturan/syarat
   - Penutup/kesimpulan
2. **Retrieve**: 4x parallel hybrid retrieval
3. **Merge & Dedup**: Gabung chunks unik dengan label hop
4. **Synthesize**: LLM generate jawaban terstruktur dengan sitasi

### 4. Guardrails Anti-Halusinasi

| Mekanisme | Fungsi |
|-----------|--------|
| `stripMetaRules()` | Hapus bocoran policy/meta |
| `containsUnverifiedClaim()` | Block klaim waktu tanpa sitasi |
| `ensureCitationsInText()` | Force sitasi di setiap kalimat |
| `finalizeAnswer()` | Pastikan semua field terisi |
| Retry Logic | Auto-retry jika output tidak memenuhi standar |

### 5. Frontend (Next.js + Tailwind)

- **Dark theme** dengan glassmorphism
- **Toggle Multi-hop/Single-hop** di header
- **4 bagian jawaban**: Overview, Detail, Aturan, Penutup
- **Citation highlighting**: [#1], [#2] dengan badge warna
- **Expandable sources** dengan hop label
- **Loading states** dan error handling

### 6. Document Sidebar & Dataset Real (Baru!)

- **Sidebar Filter**: Menu samping untuk melihat daftar dokumen dan memfilter pencarian.
- **Toggle Sidebar**: Tombol buka/tutup sidebar.
- **Dataset "Universitas Teknologi Nusantara" (UTN)**:
    - 15 Dokumen PDF buatan berdasarkan data real universitas (UI, UGM, ITB, UB, Unpad).
    - Mencakup: Sejarah, Visi Misi, Regulasi, Kode Etik, Prodi, dll.
    - Telah di-generate dan di-ingest otomatis.

![Sidebar Preview](sidebar_open_1767396761246.png)
![Real Data List](sidebar_documents_list_1767397174728.png)

---

## 🎯 Screenshot & Demo

### Halaman Awal
![Halaman awal chatbot](initial_chat_ui_1767395806844.png)

### Response dengan 4 Bagian
![Response terstruktur](chat_response_full_1767395879818.png)

### Sources dengan Hop Labels
![Sources multi-hop](sources_with_hop_labels_1767396258250.png)

---

## 📁 Struktur File Utama

```
chatbot-rag/
├── apps/
│   ├── api/
│   │   ├── server.mjs          # Backend utama (~980 baris)
│   │   ├── test-chat.mjs       # Test script
│   │   └── package.json
│   └── web/
│       └── src/app/
│           ├── page.tsx        # Chat UI (~385 baris)
│           ├── layout.tsx      # Root layout
│           └── globals.css     # Styling
├── docs/
│   ├── SETUP_GUIDE.md          # Panduan instalasi
│   ├── MENJALANKAN_PROGRAM.md  # Cara menjalankan
│   └── JUSTIFIKASI_ARSITEKTUR.md  # Perbandingan teknis
├── data/pdf/                   # Folder PDF sumber
├── README.md                   # Dokumentasi utama
└── tema_projek_chat_bot.md     # Spesifikasi proyek
```

---

## 🔧 Teknologi yang Digunakan

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Node.js, Fastify, undici |
| AI/LLM | Ollama, Llama 3 (8B) |
| Vector DB | Qdrant |
| RAG | Hybrid (Vector + BM25 + RRF) |
| Deployment | Docker (Qdrant, Ollama) |

---

## 📊 Progress vs Spesifikasi

| Requirement | Status |
|-------------|--------|
| Jawaban hanya dari PDF | ✅ |
| Format 4 bagian | ✅ |
| Sitasi wajib [#] | ✅ |
| Multi-hop retrieval | ✅ |
| Hybrid RAG | ✅ |
| Guardrail anti-halusinasi | ✅ |
| Frontend UI modern | ✅ |
| Toggle Single/Multi-hop | ✅ |

---

## 🚀 Cara Menjalankan

```bash
# 1. Start Qdrant
docker start qdrant

# 2. Start Ollama
ollama serve

# 3. Start Backend
cd apps/api && node server.mjs

# 4. Start Frontend
cd apps/web && npm run dev

# 5. Buka http://localhost:3000
```

---

## 📈 Kemungkinan Pengembangan Lanjutan

| Fitur | Prioritas | Deskripsi |
|-------|-----------|-----------|
| Graph RAG | Medium | Untuk dokumen dengan relasi kompleks |
| Chat history | Low | Persist history ke database |
| User auth | Low | Login untuk audit trail |
| OCR integration | Medium | Untuk PDF scan/gambar |

---

## 📝 Catatan untuk Bimbingan Dosen

Lihat file `docs/JUSTIFIKASI_ARSITEKTUR.md` untuk:
- Perbandingan Hybrid RAG vs Vector RAG vs Graph RAG
- Alasan pemilihan Zero-shot vs Fine-tuning
- Justifikasi pemilihan setiap teknologi
- Kutipan yang bisa dipakai saat presentasi

---

*Dokumen ini dibuat pada 3 Januari 2026*
