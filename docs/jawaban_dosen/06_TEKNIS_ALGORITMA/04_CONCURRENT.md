# Pertanyaan 20: Bagaimana Sistem Handle Concurrent Requests?

## Pertanyaan Dosen
> "Kalau banyak user bertanya bersamaan, bagaimana sistem menangani?"

---

## 🎯 Jawaban Singkat (1 Menit)

**"Pak, sistem saya handle concurrent requests dengan:**
1. **Node.js Event Loop** - Non-blocking I/O
2. **Promise.all** - Parallel processing untuk multi-hop
3. **Fastify** - Framework yang optimized untuk high throughput

**Setiap request diproses secara asynchronous, tidak blocking request lain."**

---

## 📖 Penjelasan Detail

### Node.js Event Loop

**Node.js menggunakan arsitektur non-blocking I/O:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    NODE.JS EVENT LOOP                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Timeline:                                                       │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  User A request arrives ─────┐                                  │
│                              ▼                                  │
│                         [Start processing A]                    │
│                              │                                  │
│  User B request arrives ─────│────┐                             │
│                              │    ▼                             │
│                              │ [Start processing B]             │
│                              │    │                             │
│  User C request arrives ─────│────│────┐                        │
│                              │    │    ▼                        │
│                              │    │ [Start processing C]        │
│                              │    │    │                        │
│           (Waiting for       │    │    │ (Waiting for          │
│            Ollama response)  │    │    │  Qdrant search)       │
│                              ▼    ▼    ▼                        │
│                         [Continue A] [Continue B] [Continue C]  │
│                              │    │    │                        │
│                              ▼    ▼    ▼                        │
│                         [Response] [Response] [Response]        │
│                                                                  │
│  Semua diproses "bersamaan" berkat non-blocking I/O!            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Async/Await di Kode

**📁 File:** `apps/api/server.mjs`

Semua operasi I/O menggunakan `async/await`:

**Embedding (baris 158):**
```javascript
async function embedWithOllama(text) {
  const { body } = await request(`${OLLAMA_URL}/api/embeddings`, ...);
  // Request dikirim, Node.js TIDAK BLOCKING
  // Bisa handle request lain sambil menunggu response
  return json.embedding;
}
```

**Vector Search (baris 439):**
```javascript
const vectorHits = await qdrant.search(COLLECTION_NAME, {
  vector: qVec,
  limit: topK * 2,
});
// Menunggu Qdrant, tapi tidak blocking thread
```

**LLM Chat (baris 548):**
```javascript
async function ollamaChat(messagesArg, temperature = 0.2) {
  const { body } = await request(`${OLLAMA_URL}/api/chat`, ...);
  // Menunggu Ollama generate, tapi tidak blocking
  return chatBody.json();
}
```

---

### Promise.all untuk Multi-hop

**📍 Baris:** 834-839

```javascript
// PARALLEL: 4 retrieval dijalankan bersamaan!
const [overviewChunks, detailChunks, aturanChunks, penutupChunks] = await Promise.all([
  hybridRetrieve(subQueries.overview, 4),
  hybridRetrieve(subQueries.detail, 4),
  hybridRetrieve(subQueries.aturan, 4),
  hybridRetrieve(subQueries.penutup, 4),
]);

// Tanpa Promise.all: 4 × 500ms = 2000ms (sequential)
// Dengan Promise.all: 500ms (parallel) ← 4X LEBIH CEPAT!
```

---

### Fastify Performance

Fastify dipilih karena performanya:

| Framework | Requests/sec | Notes |
|-----------|-------------|-------|
| Express | ~15,000 | Legacy, banyak middleware |
| Fastify | ~30,000 | 2x lebih cepat |
| Koa | ~20,000 | Bare metal |

**📍 Baris:** 1

```javascript
import Fastify from "fastify";

const app = Fastify({
  logger: false,        // Disable logging for performance
  bodyLimit: 52428800,  // 50MB body limit
});
```

---

### Bottleneck dan Mitigasi

| Bottleneck | Impact | Mitigasi |
|------------|--------|----------|
| **Ollama** | LLM inference lambat (~2s per request) | GPU acceleration |
| **Qdrant** | Vector search cepat (~50ms) | - |
| **BM25** | In-memory, sangat cepat (~5ms) | - |
| **PDF Parse** | CPU-bound (~500ms per PDF) | One-time during ingestion |

**Ollama adalah bottleneck utama**, tapi:
- Request A menunggu Ollama A
- Request B bisa mulai proses dan menunggu Ollama B
- Keduanya tidak saling blocking!

---

### Diagram Concurrent Handling

```
┌─────────────────────────────────────────────────────────────────┐
│              CONCURRENT REQUEST HANDLING                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Incoming Requests:                                             │
│                                                                  │
│  User A ──┐                                                     │
│  User B ──┼──► [Fastify Server] ──► [Event Loop]               │
│  User C ──┘                              │                      │
│                                          │                      │
│                                          ▼                      │
│                             ┌─────────────────────┐            │
│                             │ Request Queue       │            │
│                             │ (Non-blocking)      │            │
│                             └─────────┬───────────┘            │
│                                       │                         │
│      ┌────────────────────────────────┼────────────────┐       │
│      │                                │                │       │
│      ▼                                ▼                ▼       │
│  ┌─────────┐                    ┌─────────┐      ┌─────────┐  │
│  │Request A│                    │Request B│      │Request C│  │
│  │         │                    │         │      │         │  │
│  │ embed() │──async──►          │ embed() │      │ search()│  │
│  │ search()│──async──►          │         │      │         │  │
│  │ chat()  │──async──►          │ search()│      │ chat()  │  │
│  └─────────┘                    └─────────┘      └─────────┘  │
│      │                                │                │       │
│      │   (waiting for Ollama)         │                │       │
│      │                                │                │       │
│      ▼                                ▼                ▼       │
│  [Response A]                   [Response B]     [Response C]  │
│                                                                  │
│  All processed concurrently without blocking!                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Limitasi dan Scaling

| Aspek | Current | Scaling Option |
|-------|---------|----------------|
| **Single instance** | 1 server | Load balancer + multiple instances |
| **Ollama** | 1 GPU | Multiple Ollama instances |
| **Qdrant** | Single node | Qdrant cluster |
| **Memory** | ~500MB | Increase RAM |

**Untuk production scale:**
```
Load Balancer (Nginx)
    │
    ├── Backend Instance 1 ──┬── Ollama GPU 1
    ├── Backend Instance 2 ──┤
    └── Backend Instance 3 ──┴── Ollama GPU 2
              │
              └── Qdrant Cluster
```

---

## 🗣️ Cara Menjelaskan ke Dosen

**"Pak, sistem handle concurrent requests seperti ini:"**

1. **"Node.js non-blocking"**
   - Setiap request tidak blocking yang lain
   - Event loop handle semua secara async

2. **"Semua operasi pakai async/await"**
   - Embedding: async
   - Qdrant search: async
   - Ollama chat: async

3. **"Multi-hop pakai Promise.all"** (baris 834-839)
   - 4 retrieval dijalankan parallel
   - 4x lebih cepat dari sequential

4. **"Fastify performant"**
   - 30,000 requests/second
   - 2x lebih cepat dari Express

**"Bottleneck utama adalah Ollama (LLM inference), tapi request lain tidak ter-block saat menunggu."**

---

## ✅ Checklist Pemahaman

- [ ] Bisa jelaskan Node.js event loop
- [ ] Bisa jelaskan async/await dan non-blocking I/O
- [ ] Bisa jelaskan Promise.all untuk parallelization
- [ ] Bisa jelaskan scaling options
