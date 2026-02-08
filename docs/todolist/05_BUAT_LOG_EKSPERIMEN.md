# TODO 5: Buat Log Eksperimen

## Deskripsi
Setiap perubahan/eksperimen harus dicatat dalam log terpisah.

---

## Format Log

### Template Log

```markdown
# Eksperimen [Nomor]: [Judul]

## Tanggal
[DD/MM/YYYY]

## Perubahan yang Dilakukan
- [Perubahan 1]
- [Perubahan 2]

## File yang Diubah
- [file1.js]: [deskripsi perubahan]
- [file2.js]: [deskripsi perubahan]

## Hasil
- [Hasil pengujian]
- [Perbandingan dengan sebelumnya]

## Kesimpulan
[Apakah perubahan ini bagus atau tidak]

## Status
[ ] Diterapkan ke main
[ ] Dibatalkan
```

---

## Contoh Log

### Eksperimen 1: Single-hop RAG

**Tanggal:** 01/01/2026

**Perubahan:**
- Implementasi dasar RAG dengan single retrieval

**Hasil:**
- Jawaban cukup akurat untuk pertanyaan sederhana
- Kurang komprehensif untuk pertanyaan kompleks

**Status:** ✅ Diterapkan

---

### Eksperimen 2: Multi-hop RAG

**Tanggal:** 05/01/2026

**Perubahan:**
- Tambah query decomposition
- Retrieval 4x parallel

**Hasil:**
- Jawaban lebih lengkap
- Waktu response sedikit lebih lama

**Status:** ✅ Diterapkan

---

## Folder Struktur

```
docs/
├── logs/
│   ├── eksperimen_01_single_hop.md
│   ├── eksperimen_02_multi_hop.md
│   ├── eksperimen_03_smart_chunking.md
│   └── eksperimen_04_format_markdown.md
```

---

## Checklist

- [ ] Buat folder docs/logs
- [ ] Catat eksperimen single-hop
- [ ] Catat eksperimen multi-hop
- [ ] Catat setiap perubahan baru
- [ ] Jangan ubah kode langsung, buat branch/copy dulu
