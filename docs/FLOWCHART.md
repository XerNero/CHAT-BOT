# Flowchart Chatbot RAG
## Diagram Alur Sistem

---

## 1. Flowchart Utama - Alur Chat

```mermaid
flowchart TD
    A[👤 User Mengetik Pertanyaan] --> B[Frontend Next.js]
    B --> C{Mode RAG?}
    
    C -->|Single-hop| D["/chat API"]
    C -->|Multi-hop| E["/chat-multihop API"]
    
    D --> F[Hybrid Retrieval]
    E --> G[Query Decomposition]
    
    G --> G1[Sub-query: Overview]
    G --> G2[Sub-query: Detail]
    G --> G3[Sub-query: Aturan]
    G --> G4[Sub-query: Penutup]
    
    G1 --> H[Hybrid Retrieval x4]
    G2 --> H
    G3 --> H
    G4 --> H
    
    F --> I[Top-K Chunks]
    H --> J[Merge & Deduplicate]
    J --> I
    
    I --> K{Ada Chunk Relevan?}
    
    K -->|Tidak| L["❌ Tidak ditemukan informasi"]
    K -->|Ya| M[Buat Context + System Prompt]
    
    M --> N[Ollama LLM]
    N --> O[Jawaban + Sitasi]
    O --> P[🤖 Tampilkan di UI]
    L --> P
```

---

## 2. Flowchart Hybrid Retrieval

```mermaid
flowchart LR
    A[Pertanyaan] --> B[Vector Search]
    A --> C[BM25 Search]
    
    B --> D[Ranking Semantik]
    C --> E[Ranking Keyword]
    
    D --> F[Rank Fusion - RRF]
    E --> F
    
    F --> G[Top-K Chunks]
```

---

## 3. Flowchart Ingestion PDF

```mermaid
flowchart TD
    A[📄 Upload PDF] --> B[Ekstraksi Teks]
    B --> C[Chunking ~500 karakter]
    C --> D[Embedding via Ollama]
    D --> E[Simpan ke Qdrant]
    E --> F[✅ PDF Siap Digunakan]
    
    subgraph Metadata
        M1[source_file]
        M2[chunk_index]
        M3[text]
        M4[vector 768d]
    end
    
    E --> Metadata
```

---

## 4. Flowchart Anti-Halusinasi

```mermaid
flowchart TD
    A[Pertanyaan User] --> B{Topik Kampus?}
    
    B -->|Tidak| C["❌ Maaf, topik di luar konteks"]
    B -->|Ya| D[Retrieval]
    
    D --> E{Ada Chunk Relevan?}
    
    E -->|Tidak| F["❌ Tidak ditemukan informasi"]
    E -->|Ya| G[Generate Jawaban]
    
    G --> H{Ada Sitasi?}
    
    H -->|Tidak| I[Retry dengan prompt ketat]
    H -->|Ya| J["✅ Jawaban + [#N]"]
    
    I --> G
```

---

## 5. Flowchart Multi-hop Query Decomposition

```mermaid
flowchart TD
    A["Pertanyaan: Apa sanksi plagiarisme?"] --> B[LLM Decompose]
    
    B --> C["Overview: Apa definisi plagiarisme?"]
    B --> D["Detail: Jenis-jenis sanksi?"]
    B --> E["Aturan: Peraturan terkait?"]
    B --> F["Penutup: Cara mencegah?"]
    
    C --> G[Retrieval 1]
    D --> H[Retrieval 2]
    E --> I[Retrieval 3]
    F --> J[Retrieval 4]
    
    G --> K[Merge Chunks]
    H --> K
    I --> K
    J --> K
    
    K --> L[LLM Synthesis]
    L --> M[Jawaban Tunggal + Sitasi]
```

---

## 6. Flowchart Arsitektur Sistem

```mermaid
flowchart TB
    subgraph Frontend
        A[Next.js React]
    end
    
    subgraph Backend
        B[Fastify API]
        C[PDF Ingestion]
    end
    
    subgraph AI
        D[Ollama LLM]
        E[Embedding Model]
    end
    
    subgraph Database
        F[Qdrant VectorDB]
        G[BM25 Index]
    end
    
    A <--> B
    B --> C
    B <--> D
    B <--> E
    B <--> F
    B <--> G
    C --> E
    E --> F
```

---

## 7. Sequence Diagram - Alur Chat

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant Q as Qdrant
    participant O as Ollama
    
    U->>F: Ketik pertanyaan
    F->>B: POST /chat-multihop
    B->>O: Decompose query
    O-->>B: 4 sub-queries
    
    loop Untuk setiap sub-query
        B->>Q: Vector search
        Q-->>B: Chunks
        B->>B: BM25 search
    end
    
    B->>B: Merge & RRF
    B->>O: Generate jawaban
    O-->>B: Jawaban + sitasi
    B-->>F: Response JSON
    F-->>U: Tampilkan jawaban
```

---

## Cara Menggunakan Diagram

1. **Mermaid Live Editor**: Copy kode ke [mermaid.live](https://mermaid.live)
2. **VS Code**: Install extension "Mermaid Preview"
3. **GitHub**: Otomatis render di file .md
4. **Export**: Bisa export ke PNG/SVG dari Mermaid Live

---

*Dokumen ini dibuat untuk keperluan presentasi skripsi*  
*Terakhir diperbarui: 4 Januari 2026*
