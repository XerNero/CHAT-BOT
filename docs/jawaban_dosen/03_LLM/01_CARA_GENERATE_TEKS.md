                                                                     # Pertanyaan 8: Bagaimana LLM Generate Teks? (Attention, Transformer)

## Pertanyaan Dosen
> "Bagaimana sebenarnya LLM itu menghasilkan teks? Apa itu attention dan transformer?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, LLM (Large Language Model) generate teks dengan cara:**
1. **Tokenisasi** - Teks dipecah jadi token (kata/subkata)
2. **Embedding** - Token diubah jadi vektor
3. **Transformer** - Proses vektor dengan attention mechanism
4. **Prediksi** - Model prediksi token berikutnya
5. **Autoregressive** - Ulang sampai selesai

**Kunci utamanya adalah ATTENTION - mekanisme yang memungkinkan model 'fokus' pada bagian teks yang relevan."**

---

## 📖 Penjelasan Detail

### Apa Itu LLM?

**LLM = Large Language Model**

- Model AI dengan miliaran parameter
- Dilatih pada triliunan kata dari internet
- Bisa memahami dan menghasilkan teks

**Contoh LLM:**
| Model | Parameter | Pembuat |
|-------|-----------|---------|
| GPT-4 | ~1.7 Trillion | OpenAI |
| Llama 3 8B | 8 Billion | Meta |
| Gemini | Unknown | Google |
| Claude | Unknown | Anthropic |

---

### Arsitektur Transformer

**Transformer** adalah arsitektur neural network yang menjadi dasar semua LLM modern.

```
┌─────────────────────────────────────────────────────────────────┐
│                   TRANSFORMER ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT: "Apa syarat yudisium"                                   │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐                                            │
│  │   TOKENIZER     │  "Apa" → 123, "syarat" → 456, ...         │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │   EMBEDDING     │  123 → [0.1, 0.2, ...], 456 → [0.3, ...]  │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────┐           │
│  │              TRANSFORMER LAYERS                  │           │
│  │                                                  │           │
│  │  ┌─────────────────────────────────────────┐   │           │
│  │  │      SELF-ATTENTION MECHANISM           │   │           │
│  │  │                                         │   │           │
│  │  │  Q (Query) ─┐                          │   │           │
│  │  │  K (Key)  ──┼──► Attention Scores      │   │           │
│  │  │  V (Value) ─┘         │                │   │           │
│  │  │                       ▼                │   │           │
│  │  │              Weighted Sum              │   │           │
│  │  └─────────────────────────────────────────┘   │           │
│  │                       │                         │           │
│  │                       ▼                         │           │
│  │  ┌─────────────────────────────────────────┐   │           │
│  │  │         FEED-FORWARD NETWORK            │   │           │
│  │  └─────────────────────────────────────────┘   │           │
│  │                                                  │           │
│  │            (Repeat 32-80 layers)                │           │
│  └─────────────────────────────────────────────────┘           │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │   OUTPUT HEAD   │  Probability distribution over vocabulary  │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  OUTPUT: "adalah" (token dengan probabilitas tertinggi)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Self-Attention Mechanism

**Attention** memungkinkan model untuk "melihat" seluruh konteks saat memproses setiap kata.

**Analogi:**
- Saat membaca kalimat "Kucing itu makan karena **dia** lapar"
- Kata "dia" harus "attend" ke "kucing" untuk tahu siapa yang dimaksud
- Attention mechanism melakukan ini secara matematis

**Formula Attention:**

```
Attention(Q, K, V) = softmax(QK^T / √d_k) × V

Dimana:
- Q (Query): "Apa yang saya cari?"
- K (Key): "Apa yang tersedia?"
- V (Value): "Nilai yang dikembalikan"
- d_k: Dimensi key (untuk normalisasi)
```

**Contoh Sederhana:**

```
Input: "Kucing makan ikan"

Attention Matrix:
           Kucing  makan  ikan
Kucing     [0.6    0.2    0.2 ]  ← Kucing attend ke diri sendiri
makan      [0.3    0.4    0.3 ]  ← makan attend ke semua
ikan       [0.2    0.3    0.5 ]  ← ikan attend ke diri sendiri

0.6 = Kucing sangat relevan dengan Kucing
0.4 = makan cukup relevan dengan makan
0.3 = ikan sedikit relevan dengan makan (objek dari makan)
```

---

### Proses Generate Teks (Autoregressive)

LLM generate teks **satu token per satu**:

```
Step 1: Input: "Syarat yudisium"
        Model prediksi: "adalah" (prob: 0.85)

Step 2: Input: "Syarat yudisium adalah"
        Model prediksi: "mahasiswa" (prob: 0.72)

Step 3: Input: "Syarat yudisium adalah mahasiswa"
        Model prediksi: "harus" (prob: 0.68)

... (lanjut sampai token <END> atau max length)

Final: "Syarat yudisium adalah mahasiswa harus menyelesaikan semua mata kuliah."
```

---

### Dalam Kode Kita

**📁 File:** `apps/api/server.mjs`  
**📍 Baris:** 548-565

```javascript
async function ollamaChat(messagesArg, temperature = 0.2) {
  const { body: chatBody, statusCode } = await request(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,           // "llama3:8b"
      messages: messagesArg,       // System + User messages
      stream: false,               // Tunggu sampai selesai
      options: { temperature },    // Kontrol randomness
    }),
  });

  const json = await chatBody.json();
  return json;  // { message: { content: "..." } }
}
```

**Parameter Penting:**
- `temperature`: Kontrol kreativitas (0 = deterministik, 1 = kreatif)
- `stream: false`: Kita tunggu jawaban lengkap

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, LLM generate teks seperti ini:"**

1. **"Teks dipecah jadi token"**
   - "Apa syarat" → [123, 456, 789]
   - Setiap kata/subkata punya ID

2. **"Token diubah jadi vektor"**
   - ID 123 → [0.1, 0.2, 0.3, ...]
   - Vektor merepresentasikan makna

3. **"Transformer memproses dengan Attention"**
   - Setiap token "melihat" token lain
   - Menghitung relevansi dengan formula Q×K×V

4. **"Prediksi token berikutnya"**
   - Output: probabilitas untuk setiap kata di vocabulary
   - Pilih yang probabilitasnya tertinggi

5. **"Ulangi sampai selesai"**
   - Autoregressive: token baru masuk input
   - Sampai token END atau max length

**"Ini semua terjadi di Ollama, Pak. Kita kirim teks, Ollama proses dengan llama3:8b, return hasilnya."**

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan apa itu LLM
- [ ] Bisa jelaskan arsitektur Transformer
- [ ] Bisa jelaskan Self-Attention (Q, K, V)
- [ ] Bisa jelaskan proses autoregressive
- [ ] Bisa hubungkan dengan kode kita (ollamaChat)
