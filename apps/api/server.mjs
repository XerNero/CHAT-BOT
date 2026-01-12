import Fastify from "fastify";
import { QdrantClient } from "@qdrant/js-client-rest";
import { request } from "undici";
import multipart from "@fastify/multipart";
import { createRequire } from "module";

// =====================
// FIX pdf-parse (Node v24 + ESM)
// =====================
const require = createRequire(import.meta.url);
const pdfParseMod = require("pdf-parse");

const pdfParse =
  (typeof pdfParseMod === "function" && pdfParseMod) ||
  (typeof pdfParseMod?.default === "function" && pdfParseMod.default) ||
  (typeof pdfParseMod?.pdf === "function" && pdfParseMod.pdf) ||
  (typeof pdfParseMod?.default?.default === "function" && pdfParseMod.default.default);

if (!pdfParse) {
  throw new Error(
    "pdf-parse export tidak ditemukan sebagai function. Coba: pnpm remove pdf-parse && pnpm add pdf-parse@1.1.1"
  );
}

// =====================
// App
// =====================
const app = Fastify({ logger: true });

// =====================
// CORS (manual, aman untuk preflight)
// =====================
app.addHook("onRequest", async (req, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  reply.header("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    // Preflight
    reply.code(204).send();
    return reply; // penting agar handler lain tidak lanjut
  }
});

// multipart upload (Fastify v5)
await app.register(multipart, {
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// =====================
// Windows host (penting untuk WSL/Ubuntu)
// Default: 172.17.112.1 (sering jadi gateway WSL)
// =====================
const WIN_HOST = process.env.WIN_HOST || "172.17.112.1";

// services
const qdrant = new QdrantClient({
  url: `http://${WIN_HOST}:6333`,
  checkCompatibility: false,
});

const OLLAMA_URL = `http://${WIN_HOST}:11434`;

// config
const COLLECTION_NAME = "pdf_chunks";
const CHAT_MODEL = "llama3:8b";
const EMBED_MODEL = "llama3:8b";

// =====================
// Helpers (chunking & embeddings)
// =====================

/**
 * Smart Chunking - Memotong teks dengan mempertimbangkan:
 * 1. Batas paragraf (prioritas tertinggi)
 * 2. Batas kalimat (titik, tanda seru, tanda tanya)
 * 3. Heading seperti BAB, Pasal, Bagian (sebagai pemisah alami)
 * 4. Overlap untuk konteks antar chunk
 */
function chunkText(text, maxChars = 800, overlap = 150) {
  // Bersihkan teks
  const cleaned = String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return [];

  // Split berdasarkan paragraf (double newline)
  const paragraphs = cleaned.split(/\n\n+/);

  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Cek apakah paragraf ini adalah heading baru (BAB, Pasal, dll)
    const isNewSection = /^(BAB|BAGIAN|PASAL|ARTIKEL|PERATURAN|KETENTUAN|\d+\.\s|\d+\)|\([a-z]\))/i.test(trimmedPara);

    // Jika heading baru dan currentChunk tidak kosong, simpan chunk sebelumnya
    if (isNewSection && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    // Jika menambahkan paragraf ini melebihi maxChars
    if (currentChunk.length + trimmedPara.length + 2 > maxChars) {
      // Jika currentChunk sudah ada isinya, simpan dulu
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());

        // Ambil overlap dari akhir chunk sebelumnya
        const sentences = currentChunk.split(/(?<=[.!?])\s+/);
        const overlapText = sentences.slice(-2).join(" "); // 2 kalimat terakhir
        currentChunk = overlapText.length < overlap * 2 ? overlapText + "\n\n" : "";
      }

      // Jika paragraf tunggal terlalu panjang, pecah berdasarkan kalimat
      if (trimmedPara.length > maxChars) {
        const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
        let sentenceChunk = currentChunk;

        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 1 > maxChars) {
            if (sentenceChunk.trim()) {
              chunks.push(sentenceChunk.trim());
            }
            // Overlap: ambil kalimat terakhir
            const lastSentences = sentenceChunk.split(/(?<=[.!?])\s+/).slice(-1);
            sentenceChunk = lastSentences.join(" ") + " " + sentence;
          } else {
            sentenceChunk += (sentenceChunk ? " " : "") + sentence;
          }
        }
        currentChunk = sentenceChunk;
      } else {
        currentChunk += trimmedPara;
      }
    } else {
      // Tambahkan paragraf ke chunk saat ini
      currentChunk += (currentChunk ? "\n\n" : "") + trimmedPara;
    }
  }

  // Jangan lupa chunk terakhir
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Filter chunk yang terlalu pendek (kurang dari 50 karakter)
  return chunks.filter(c => c.length >= 50);
}

async function embedWithOllama(text) {
  const { body, statusCode } = await request(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: String(text || "") }),
  });

  if (statusCode < 200 || statusCode >= 300) {
    const errText = await body.text();
    throw new Error(`Ollama embeddings failed: ${statusCode} ${errText}`);
  }

  const json = await body.json();
  if (!json?.embedding || !Array.isArray(json.embedding)) {
    throw new Error("Ollama embeddings response invalid (no embedding array).");
  }

  return json.embedding;
}

async function ensureCollection(vectorSize) {
  const existing = await qdrant.getCollections();
  const exists = (existing.collections ?? []).some((c) => c.name === COLLECTION_NAME);
  if (exists) return;

  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: { size: vectorSize, distance: "Cosine" },
  });
}

// =====================
// HYBRID RETRIEVAL CACHE (BM25)
// =====================
let keywordCache = { loadedAt: 0, points: [] };

function nowMs() {
  return Date.now();
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  const t = normalizeText(s);
  if (!t) return [];
  return t.split(" ").filter((w) => w.length >= 2);
}

const STOPWORDS_ID = new Set([
  "yang",
  "dan",
  "atau",
  "di",
  "ke",
  "dari",
  "pada",
  "untuk",
  "dengan",
  "adalah",
  "itu",
  "ini",
  "dalam",
  "sebagai",
  "oleh",
  "agar",
  "bagi",
  "setiap",
  "akan",
  "dapat",
  "tidak",
  "harus",
  "kami",
  "kamu",
  "anda",
  "para",
  "jika",
  "maka",
  "saat",
  "ketika",
  "lebih",
  "kurang",
]);

function filterStopwords(tokens) {
  return tokens.filter((t) => !STOPWORDS_ID.has(t));
}

function bm25Score(queryTokens, docTokens, dfMap, avgdl, k1 = 1.2, b = 0.75) {
  if (docTokens.length === 0) return 0;

  const tf = new Map();
  for (const tok of docTokens) tf.set(tok, (tf.get(tok) || 0) + 1);

  const dl = docTokens.length;
  let score = 0;

  for (const q of queryTokens) {
    const f = tf.get(q) || 0;
    if (!f) continue;

    const df = dfMap.get(q) || 0;
    const idf = Math.log(1 + ((keywordCache.points.length - df + 0.5) / (df + 0.5)));
    const denom = f + k1 * (1 - b + b * (dl / (avgdl || 1)));
    score += idf * ((f * (k1 + 1)) / (denom || 1));
  }

  return score;
}

async function loadKeywordCache() {
  const points = [];
  let offset = undefined;

  while (true) {
    const res = await qdrant.scroll(COLLECTION_NAME, {
      with_payload: true,
      with_vector: false,
      limit: 256,
      offset,
    });

    for (const p of res.points || []) {
      if (p?.payload?.text) points.push({ id: p.id, payload: p.payload });
    }

    if (!res.next_page_offset) break;
    offset = res.next_page_offset;
  }

  keywordCache = { loadedAt: nowMs(), points };
  app.log.info({ count: points.length }, "keywordCache loaded");
  return keywordCache;
}

function buildDfMapAndAvgdl(points) {
  const df = new Map();
  let totalLen = 0;

  for (const p of points) {
    const toks = new Set(filterStopwords(tokenize(p.payload.text)));
    totalLen += toks.size;
    for (const t of toks) df.set(t, (df.get(t) || 0) + 1);
  }

  const avgdl = points.length ? totalLen / points.length : 0;
  return { df, avgdl };
}

function rrfFuse(rankA, rankB, k = 60) {
  const scores = new Map();
  for (const [id, r] of rankA.entries()) scores.set(id, (scores.get(id) || 0) + 1 / (k + r));
  for (const [id, r] of rankB.entries()) scores.set(id, (scores.get(id) || 0) + 1 / (k + r));
  return scores;
}

// =====================
// Output parsing + quality gate
// =====================
function safeJsonParse(str) {
  const s = String(str || "").trim();
  try {
    return JSON.parse(s);
  } catch { }

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const cut = s.slice(first, last + 1);
    try {
      return JSON.parse(cut);
    } catch { }
  }
  return null;
}

function hasCitations(text) {
  const t = String(text || "");
  return /\[#\d+\]/.test(t);
}

function isNotFoundText(s) {
  return /tidak ditemukan/i.test(String(s || ""));
}

// buang meta kalimat yg sering bocor
function stripMetaRules(s) {
  let t = String(s || "").trim();
  if (!t) return "";

  const metaPatterns = [
    /jawaban chatbot/i,
    /chatbot/i,
    /context/i,
    /konteks/i,
    /instruksi/i,
    /aturan/i,
    /prompt/i,
    /kami sarankan/i,
    /cari sumber lain/i,
    /sumber lain/i,
    /dapat disimpulkan/i,
    /inferensi/i,
  ];

  const parts = t.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((sent) => {
    const x = sent.trim();
    if (!x) return false;
    for (const p of metaPatterns) {
      if (p.test(x)) return false;
    }
    return true;
  });

  t = kept.join(" ").trim();
  if (/^(jawaban|aturan)\b/i.test(t) && t.length < 15) return "";
  return t;
}

// fallback sitasi: kalau LLM bandel
function ensureCitationsInText(text, defaultRef = "[#1]") {
  const s = String(text || "").trim();
  if (!s) return s;
  if (hasCitations(s)) return s;

  return s
    .split(/(?<=[.!?])\s+/)
    .map((sent) => {
      const st = sent.trim();
      if (!st) return st;
      if (isNotFoundText(st)) return st;
      return `${st} ${defaultRef}`;
    })
    .join(" ");
}

/**
 * Post-process LLM output untuk memformat Markdown dengan benar
 * - Menambahkan line break sebelum numbered list (1. 2. 3.)
 * - Menambahkan line break sebelum bullet points (- atau *)
 * - Memformat nilai/bobot dalam list yang rapi
 */
function formatAnswerMarkdown(text) {
  if (!text) return text;

  let formatted = text
    // Tambahkan line break sebelum numbered list (1) atau 1.
    .replace(/\s*\((\d+)\)\s*/g, '\n\n$1. ')
    .replace(/(?<!\n)\s*(\d+)\.\s+/g, '\n\n$1. ')
    // Tambahkan line break sebelum bullet points
    .replace(/(?<!\n)\s*[-•]\s+/g, '\n- ')
    // Format nilai (A = 4.00, B = 3.00) jadi list
    .replace(/([A-E][+-]?)\s*=\s*([\d.]+)\s*\(([^)]+)\)/g, '\n- **$1** = $2 ($3)')
    // Bersihkan multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return formatted;
}

function finalizeAnswer(answerText) {
  let out = stripMetaRules(String(answerText || ""));
  if (!out) return "Tidak ditemukan informasi yang relevan di dokumen.";

  // Format Markdown
  out = formatAnswerMarkdown(out);

  return out;
}

// =====================
// Hybrid Retrieval Helper (reusable)
// =====================
async function hybridRetrieve(queryText, topK = 6) {
  const qVec = await embedWithOllama(queryText);

  const vectorHits = await qdrant.search(COLLECTION_NAME, {
    vector: qVec,
    limit: topK * 2,
    with_payload: true,
    with_vector: false,
  });

  const vectorRank = new Map();
  for (let i = 0; i < (vectorHits || []).length; i++) {
    vectorRank.set(String(vectorHits[i].id), i + 1);
  }

  const qToks = filterStopwords(tokenize(queryText));
  const { df, avgdl } = buildDfMapAndAvgdl(keywordCache.points);

  const bm25Scored = keywordCache.points
    .map((p) => {
      const docToks = filterStopwords(tokenize(p.payload.text));
      return { id: String(p.id), score: bm25Score(qToks, docToks, df, avgdl), payload: p.payload };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK * 2);

  const keywordRank = new Map();
  for (let i = 0; i < bm25Scored.length; i++) keywordRank.set(bm25Scored[i].id, i + 1);

  const fused = rrfFuse(vectorRank, keywordRank, 60);
  const fusedSorted = Array.from(fused.entries()).sort((a, b) => b[1] - a[1]).slice(0, topK);

  const idToPayload = new Map();
  for (const hit of vectorHits || []) idToPayload.set(String(hit.id), hit.payload);
  for (const hit of bm25Scored) idToPayload.set(String(hit.id), hit.payload);

  return fusedSorted
    .map(([id, score]) => {
      const payload = idToPayload.get(id);
      if (!payload?.text) return null;
      return {
        id,
        score,
        source_file: payload.source_file,
        chunk_index: payload.chunk_index,
        text: payload.text,
      };
    })
    .filter(Boolean);
}

// =====================
// Query Decomposition (Multi-hop)
// =====================
async function decomposeQuery(question) {
  const decomposePrompt = `Kamu adalah sistem pemecah pertanyaan untuk pencarian dokumen.
Ubah pertanyaan pengguna menjadi 4 sub-pertanyaan pencarian:
1) overview/definisi
2) detail/poin utama/langkah
3) batasan/syarat/pengecualian (aturan)
4) closure/tindak lanjut (penutup)

ATURAN:
- Output HARUS JSON valid dengan kunci: "overview","detail","aturan","penutup"
- Tiap nilai adalah 1 kalimat tanya, bahasa Indonesia
- Jangan menambahkan fakta di luar pertanyaan pengguna

Pertanyaan pengguna:
${question}`;

  try {
    const { body, statusCode } = await request(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [{ role: "user", content: decomposePrompt }],
        stream: false,
        options: { temperature: 0.1 },
      }),
    });

    if (statusCode >= 200 && statusCode < 300) {
      const json = await body.json();
      const content = json?.message?.content || "";
      const parsed = safeJsonParse(content);
      if (parsed && parsed.overview && parsed.detail && parsed.aturan && parsed.penutup) {
        return {
          overview: String(parsed.overview).trim(),
          detail: String(parsed.detail).trim(),
          aturan: String(parsed.aturan).trim(),
          penutup: String(parsed.penutup).trim(),
        };
      }
    }
  } catch {
    // ignore
  }

  // fallback
  return {
    overview: `Apa definisi dan konteks umum tentang: ${question}?`,
    detail: `Apa langkah-langkah atau poin utama terkait: ${question}?`,
    aturan: `Apa syarat, batasan, atau pengecualian terkait: ${question}?`,
    penutup: `Apa kesimpulan atau tindak lanjut terkait: ${question}?`,
  };
}

// =====================
// OLLAMA helper
// =====================
async function ollamaChat(messagesArg, temperature = 0.2) {
  const { body: chatBody, statusCode } = await request(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: messagesArg,
      stream: false,
      options: { temperature },
    }),
  });

  if (statusCode < 200 || statusCode >= 300) {
    const errText = await chatBody.text();
    throw new Error(`Ollama chat failed: ${statusCode} ${errText}`);
  }
  return chatBody.json();
}

// =====================
// ROUTES
// =====================
app.get("/health", async () => {
  const collections = await qdrant.getCollections();

  const { body, statusCode } = await request(`${OLLAMA_URL}/api/tags`);
  if (statusCode < 200 || statusCode >= 300) throw new Error(`Ollama not reachable: ${statusCode}`);
  const tags = await body.json();

  return {
    ok: true,
    win_host: WIN_HOST,
    qdrant: { ok: true, collections_count: collections.collections?.length ?? 0 },
    ollama: { ok: true, models: (tags.models ?? []).map((m) => m.name) },
  };
});

/**
 * GET /docs
 * List all ingested documents with chunk counts (paginated scroll)
 */
app.get("/docs", async (req, reply) => {
  try {
    const docMap = new Map();
    let offset = undefined;
    let total = 0;

    while (true) {
      const res = await qdrant.scroll(COLLECTION_NAME, {
        limit: 512,
        with_payload: true,
        with_vector: false,
        offset,
      });

      const points = res.points || [];
      for (const p of points) {
        total++;
        const sf = p.payload?.source_file || "unknown";
        docMap.set(sf, (docMap.get(sf) || 0) + 1);
      }

      if (!res.next_page_offset) break;
      offset = res.next_page_offset;
    }

    const docs = Array.from(docMap.entries()).map(([source_file, chunks], idx) => ({
      id: `doc-${idx + 1}`,
      source_file,
      chunks,
    }));

    return reply.send({
      ok: true,
      total_docs: docs.length,
      total_chunks: total,
      docs,
    });
  } catch (err) {
    req.log.error({ err }, "docs list failed");
    return reply.code(500).send({ ok: false, message: err?.message || "docs list failed" });
  }
});

/**
 * POST /ingest
 * form-data field name: "file"
 * Optional query: maxChars=1200 overlap=200
 */
app.post("/ingest", async (req, reply) => {
  try {
    const data = await req.file();
    if (!data) {
      return reply.code(400).send({
        ok: false,
        message: 'No PDF uploaded. Use multipart form-data field name: "file"',
      });
    }

    if (data.mimetype !== "application/pdf") {
      return reply.code(400).send({ ok: false, message: "File must be a PDF" });
    }

    const buf = await data.toBuffer();
    const maxChars = Number(req.query?.maxChars ?? 1200);
    const overlap = Number(req.query?.overlap ?? 200);

    const parsed = await pdfParse(buf);
    const fullText = (parsed?.text ?? "").trim();

    if (!fullText) {
      return reply.code(400).send({
        ok: false,
        message: "PDF has no extractable text. If this is scanned PDF, you need OCR.",
      });
    }

    const chunks = chunkText(fullText, maxChars, overlap);
    if (chunks.length === 0) {
      return reply.code(400).send({ ok: false, message: "No chunks produced from PDF text." });
    }

    const firstVec = await embedWithOllama(chunks[0]);
    await ensureCollection(firstVec.length);

    const batchId = Date.now();
    const sourceFile = data.filename || "uploaded.pdf";

    const points = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const vec = idx === 0 ? firstVec : await embedWithOllama(chunks[idx]);
      points.push({
        id: batchId + idx,
        vector: vec,
        payload: {
          source_file: sourceFile,
          chunk_index: idx,
          text: chunks[idx],
          batch_id: batchId,
        },
      });
    }

    await qdrant.upsert(COLLECTION_NAME, { wait: true, points });
    await loadKeywordCache();

    return reply.send({
      ok: true,
      collection: COLLECTION_NAME,
      chunks: chunks.length,
      source_file: sourceFile,
      chunking: { maxChars, overlap },
    });
  } catch (err) {
    req.log.error({ err }, "ingest failed");
    return reply.code(500).send({ ok: false, message: err?.message || "ingest failed" });
  }
});

/**
 * POST /chat
 * Body: { question: string, history?: [{role, content}] }
 * Output: { ok, answer: string, sources: [...] }
 */
app.post("/chat", async (req, reply) => {
  try {
    const body = req.body || {};
    const question = String(body.question || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!question) return reply.code(400).send({ ok: false, message: "question is required" });
    if (!keywordCache.points.length) await loadKeywordCache();

    const contextChunks = await hybridRetrieve(question, 8);

    if (!contextChunks.length) {
      return reply.send({
        ok: true,
        answer: "Tidak ditemukan informasi yang relevan di dokumen.",
        sources: [],
      });
    }

    const contextText = contextChunks.map((c, idx) => `[#${idx + 1}]\n${c.text}`).join("\n\n---\n\n");

    const system = `Kamu adalah asisten kampus berbasis dokumen.

ATURAN FORMAT JAWABAN:
- Gunakan **Markdown** untuk format yang rapi dan mudah dibaca.
- Gunakan heading (## atau ###) untuk judul bagian jika perlu.
- Gunakan numbered list (1. 2. 3.) untuk langkah-langkah atau poin berurutan.
- Gunakan bullet points (- atau *) untuk daftar item.
- Gunakan **bold** untuk istilah penting.
- Jika ada tabel/nilai, tampilkan dalam format list yang rapi.

ATURAN KONTEN:
- Jawaban HANYA berdasarkan CONTEXT yang diberikan.
- Jika tidak ada bukti di CONTEXT, tulis: "Tidak ditemukan informasi yang relevan di dokumen."
- Jangan menyebut "chatbot", "prompt", "instruksi", "konteks", atau aturan internal.
- WAJIB pakai sitasi [#N] di akhir setiap fakta/kalimat penting.
- Bahasa Indonesia.

CONTOH FORMAT JAWABAN YANG BAIK:
### Pasal 10 - Penilaian Hasil Belajar

1. Penilaian hasil belajar mahasiswa dilakukan secara berkala berbentuk ujian, pelaksanaan tugas, dan pengamatan oleh dosen. [#1]

2. Ujian dapat diselenggarakan melalui:
   - Ujian Tengah Semester (UTS)
   - Ujian Akhir Semester (UAS)
   - Ujian Akhir Program Studi [#1]

3. Nilai huruf dan bobot:
   - **A** = 4.00 (Istimewa)
   - **A-** = 3.70 (Sangat Baik)
   - **B+** = 3.30 (Baik Sekali)
   - **B** = 3.00 (Baik) [#1]`;

    const userPrompt = `PERTANYAAN:\n${question}\n\nCONTEXT:\n${contextText}`;

    const baseMessages = [
      { role: "system", content: system },
      ...history.slice(-6).map((m) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user", content: userPrompt },
    ];

    let raw = "";
    let answer = "";

    // attempt 1
    const chat1 = await ollamaChat(baseMessages, 0.2);
    raw = chat1?.message?.content || "";
    answer = finalizeAnswer(raw);

    // retry kalau tidak ada sitasi (dan bukan “tidak ditemukan”)
    if (!hasCitations(answer) && !isNotFoundText(answer)) {
      const repairMessages = [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
        {
          role: "user",
          content:
            "Ulangi jawaban dengan format narasi yang sama, tetapi PASTIKAN setiap fakta/kalimat penting diakhiri sitasi [#N] sesuai CONTEXT. Jangan menambah info di luar CONTEXT.",
        },
      ];
      const chat2 = await ollamaChat(repairMessages, 0.0);
      raw = chat2?.message?.content || raw;
      answer = finalizeAnswer(raw);
    }

    // fallback: kalau masih bandel, tempelin [#1]
    answer = ensureCitationsInText(answer, "[#1]");

    return reply.send({
      ok: true,
      answer,
      sources: contextChunks.map((c, i) => ({
        ref: `#${i + 1}`,
        id: c.id,
        source_file: c.source_file,
        chunk_index: c.chunk_index,
        fused_score: c.score,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "chat failed");
    return reply.code(500).send({ ok: false, message: err?.message || "chat failed" });
  }
});

/**
 * POST /chat-multihop
 * Body: { question: string, history?: [...] }
 * Output: { ok, answer: string, sources: [...], debug: {...} }
 */
app.post("/chat-multihop", async (req, reply) => {
  try {
    const body = req.body || {};
    const question = String(body.question || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!question) return reply.code(400).send({ ok: false, message: "question is required" });
    if (!keywordCache.points.length) await loadKeywordCache();

    const subQueries = await decomposeQuery(question);

    const [overviewChunks, detailChunks, aturanChunks, penutupChunks] = await Promise.all([
      hybridRetrieve(subQueries.overview, 4),
      hybridRetrieve(subQueries.detail, 4),
      hybridRetrieve(subQueries.aturan, 4),
      hybridRetrieve(subQueries.penutup, 4),
    ]);

    const seenIds = new Set();
    const allChunks = [];
    const add = (chunks, hop) => {
      for (const c of chunks) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          allChunks.push({ ...c, hop });
        }
      }
    };

    add(overviewChunks, "overview");
    add(detailChunks, "detail");
    add(aturanChunks, "aturan");
    add(penutupChunks, "penutup");

    const hopsFound = {
      overview: overviewChunks.length > 0,
      detail: detailChunks.length > 0,
      aturan: aturanChunks.length > 0,
      penutup: penutupChunks.length > 0,
    };

    if (!allChunks.length) {
      return reply.send({
        ok: true,
        answer: "Tidak ditemukan informasi yang relevan di dokumen.",
        sources: [],
        debug: { hopsFound, subQueries },
      });
    }

    const contextText = allChunks
      .map((c, idx) => `[#${idx + 1}] (${c.hop})\n${c.text}`)
      .join("\n\n---\n\n");

    const system = `Kamu adalah asisten kampus berbasis dokumen.

ATURAN FORMAT JAWABAN:
- Gunakan **Markdown** untuk format yang rapi dan mudah dibaca.
- Gunakan heading (## atau ###) untuk judul bagian jika perlu.
- Gunakan numbered list (1. 2. 3.) untuk langkah-langkah atau poin berurutan.
- Gunakan bullet points (- atau *) untuk daftar item.
- Gunakan **bold** untuk istilah penting.
- Jika ada tabel/nilai, tampilkan dalam format list yang rapi.

ATURAN KONTEN:
- Jawaban HANYA berdasarkan CONTEXT yang diberikan.
- Jika tidak ada bukti di CONTEXT, tulis: "Tidak ditemukan informasi yang relevan di dokumen."
- Jangan menyebut "chatbot", "prompt", "instruksi", "konteks", atau aturan internal.
- WAJIB pakai sitasi [#N] di akhir setiap fakta/kalimat penting.
- Bahasa Indonesia.

CONTOH FORMAT JAWABAN YANG BAIK:
### Pasal 10 - Penilaian Hasil Belajar

1. Penilaian hasil belajar mahasiswa dilakukan secara berkala. [#1]

2. Ujian dapat diselenggarakan melalui:
   - Ujian Tengah Semester (UTS)
   - Ujian Akhir Semester (UAS) [#1]

3. Nilai huruf dan bobot:
   - **A** = 4.00 (Istimewa)
   - **B** = 3.00 (Baik) [#2]`;

    const userPrompt = `PERTANYAAN:\n${question}\n\nCONTEXT:\n${contextText}`;

    const baseMessages = [
      { role: "system", content: system },
      ...history.slice(-6).map((m) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user", content: userPrompt },
    ];

    let raw = "";
    let answer = "";

    const chat1 = await ollamaChat(baseMessages, 0.2);
    raw = chat1?.message?.content || "";
    answer = finalizeAnswer(raw);

    if (!hasCitations(answer) && !isNotFoundText(answer)) {
      const repairMessages = [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
        {
          role: "user",
          content:
            "Ulangi jawaban. PASTIKAN setiap fakta/kalimat penting diakhiri sitasi [#N] sesuai CONTEXT. Jangan menambah info di luar CONTEXT.",
        },
      ];
      const chat2 = await ollamaChat(repairMessages, 0.0);
      raw = chat2?.message?.content || raw;
      answer = finalizeAnswer(raw);
    }

    answer = ensureCitationsInText(answer, "[#1]");

    return reply.send({
      ok: true,
      answer,
      sources: allChunks.map((c, i) => ({
        ref: `#${i + 1}`,
        id: c.id,
        source_file: c.source_file,
        chunk_index: c.chunk_index,
        hop: c.hop,
        fused_score: c.score,
      })),
      debug: { hopsFound, subQueries },
    });
  } catch (err) {
    req.log.error({ err }, "chat-multihop failed");
    return reply.code(500).send({ ok: false, message: err?.message || "chat-multihop failed" });
  }
});


// =====================
// START
// =====================
app.listen({ port: 3001, host: "0.0.0.0" }, () => {
  console.log("========================================");
  console.log("  Chatbot RAG API Server Started");
  console.log("========================================");
  console.log(`  WIN_HOST   : ${WIN_HOST}`);
  console.log(`  OLLAMA     : ${OLLAMA_URL}`);
  console.log(`  Server     : http://0.0.0.0:3001`);
  console.log("========================================");
});
