# TODO 1: Pahami Alur Program dari Awal Sampai Akhir

## Deskripsi
Memahami step-by-step bagaimana program berjalan dari user input hingga output jawaban.

---

## Alur Lengkap

```
1. USER INPUT
   └── User ketik pertanyaan di browser

2. FRONTEND (apps/web)
   └── Next.js kirim POST request ke /chat-multihop

3. BACKEND - RECEIVE REQUEST (apps/api/server.mjs)
   └── Baris 823-829: Terima dan validasi request

4. QUERY DECOMPOSITION
   └── Baris 832: decomposeQuery(question)
   └── Pecah jadi 4 sub-query: overview, detail, aturan, penutup

5. HYBRID RETRIEVAL (4x parallel)
   └── Baris 834-839: hybridRetrieve() untuk setiap sub-query
   └── Di dalam hybridRetrieve():
       ├── Baris 437: embedWithOllama() → vektor query
       ├── Baris 439-444: qdrant.search() → Vector Search
       ├── Baris 451-461: bm25Score() → BM25 Search
       └── Baris 466: rrfFuse() → Gabung ranking

6. MERGE & DEDUP
   └── Baris 841-855: Gabung semua chunks, hapus duplikat

7. CONTEXT BUILDING
   └── Baris 873-875: Format chunks dengan [#N]

8. LLM SYNTHESIS
   └── Baris 909-913: Siapkan messages (system + user + context)
   └── Baris 918: ollamaChat() → Generate jawaban

9. POST-PROCESSING
   └── Baris 920: finalizeAnswer() → Bersihkan output
   └── Baris 937: ensureCitationsInText() → Pastikan ada sitasi

10. RESPONSE
    └── Baris 939-951: Return JSON dengan answer + sources

11. FRONTEND RENDER
    └── apps/web/src/app/page.tsx: Render Markdown + sitasi

12. USER SEES ANSWER
```

---

## File yang Perlu Dipelajari

| File | Baris | Fungsi |
|------|-------|--------|
| `server.mjs` | 823-956 | Endpoint /chat-multihop |
| `server.mjs` | 491-543 | decomposeQuery() |
| `server.mjs` | 436-486 | hybridRetrieve() |
| `server.mjs` | 158-176 | embedWithOllama() |
| `server.mjs` | 311-316 | rrfFuse() |
| `page.tsx` | - | Frontend render |

---

## Checklist Pemahaman

- [ ] Bisa jelaskan alur dari user input ke jawaban
- [ ] Bisa jelaskan fungsi setiap komponen
- [ ] Bisa tunjukkan baris kode yang relevan
- [ ] Bisa gambar diagram alur
