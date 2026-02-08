# TODO 3: Dokumentasi Cara Membangun RAG dan Library

## Deskripsi
Dokumentasikan secara lengkap bagaimana RAG ini dibangun beserta library yang digunakan.

---

## Library yang Digunakan

### Backend (Node.js)

| Library | Fungsi | Baris Import |
|---------|--------|--------------|
| `fastify` | HTTP server | 1 |
| `@qdrant/js-client-rest` | Vector DB client | 2 |
| `undici` | HTTP client | 3 |
| `@fastify/multipart` | File upload | 4 |
| `pdf-parse` | PDF to text | 10-11 |

### External Services

| Service | Port | Fungsi |
|---------|------|--------|
| Ollama | 11434 | LLM + Embedding |
| Qdrant | 6333 | Vector Database |

### Model AI

| Model | Fungsi |
|-------|--------|
| `llama3:8b` | Chat + Embedding |

---

## Cara Membangun

### Step 1: Setup Environment
```bash
# Install Node.js, Docker, Ollama
# Pull model
ollama pull llama3:8b
# Start Qdrant
docker run -d -p 6333:6333 qdrant/qdrant
```

### Step 2: Buat Server dengan Fastify
```javascript
import Fastify from "fastify";
const app = Fastify({ logger: true });
```

### Step 3: Koneksi ke Qdrant
```javascript
import { QdrantClient } from "@qdrant/js-client-rest";
const qdrant = new QdrantClient({ url: "http://localhost:6333" });
```

### Step 4: Buat Fungsi Embedding
```javascript
async function embedWithOllama(text) {
  const response = await request("http://localhost:11434/api/embeddings", {
    body: JSON.stringify({ model: "llama3:8b", prompt: text })
  });
  return response.embedding;
}
```

### Step 5: Buat Endpoint Ingest
```javascript
app.post("/ingest", async (req, reply) => {
  // 1. Parse PDF
  // 2. Chunk text
  // 3. Embed chunks
  // 4. Simpan ke Qdrant
});
```

### Step 6: Buat Endpoint Chat
```javascript
app.post("/chat-multihop", async (req, reply) => {
  // 1. Decompose query
  // 2. Hybrid retrieve
  // 3. Generate answer
});
```

---

## Checklist

- [ ] Bisa sebutkan semua library dan fungsinya
- [ ] Bisa jelaskan cara setup environment
- [ ] Bisa jelaskan langkah-langkah membangun RAG
- [ ] Bisa tunjukkan kode untuk setiap langkah
