# TODO 4: Buat Recording Demo

## Deskripsi
Buat video recording yang menunjukkan sistem berjalan dari awal sampai akhir.

---

## Yang Harus Di-record

### 1. Menjalankan Sistem
- Start Qdrant (Docker)
- Start Ollama
- Start Backend (node server.mjs)
- Start Frontend (npm run dev)

### 2. Demo Ingest PDF
- Upload PDF via Postman atau UI
- Tunjukkan hasil chunking
- Tunjukkan data masuk ke Qdrant

### 3. Demo Chat
- Ketik pertanyaan di UI
- Tunggu jawaban muncul
- Tunjukkan jawaban dengan sitasi

### 4. Demo Anti-Halusinasi
- Tanya pertanyaan tentang kampus → dijawab
- Tanya pertanyaan di luar topik → ditolak
- Tanya pertanyaan tanpa info → ditolak

---

## Tools untuk Recording

1. **OBS Studio** - Gratis, bisa record screen
2. **Windows Game Bar** - Win+G, built-in Windows
3. **Loom** - Web-based, mudah share

---

## Durasi Ideal

- Total: 5-10 menit
- Ingest: 2 menit
- Chat demo: 3 menit
- Anti-halusinasi: 2 menit

---

## Checklist

- [ ] Sistem berjalan lancar
- [ ] Recording tools ready
- [ ] Record demo ingest
- [ ] Record demo chat
- [ ] Record demo anti-halusinasi
- [ ] Kirim ke dosen sebelum Jumat
