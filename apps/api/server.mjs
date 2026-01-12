import Fastify from "fastify";
import { QdrantClient } from "@qdrant/js-client-rest";
import { request } from "undici";
import multipart from "@fastify/multipart";
import { createRequire } from "module";

// =====================
// FIX FINAL pdf-parse (Node v24 + ESM)
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

// CORS for frontend
app.addHook('onRequest', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    reply.status(204).send();
  }
});

await app.register(multipart, {
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// services
const qdrant = new QdrantClient({
  url: "http://127.0.0.1:6333",
  checkCompatibility: false,
});

const OLLAMA_URL = "http://127.0.0.1:11434";

// config
const COLLECTION_NAME = "pdf_chunks";
const CHAT_MODEL = "llama3:8b";
const EMBED_MODEL = "llama3:8b";

// =====================
// Helpers (chunking & embeddings)
// =====================
function chunkText(text, maxChars = 1200, overlap = 200) {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const chunks = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(i + maxChars, cleaned.length);
    const slice = cleaned.slice(i, end).trim();
    if (slice) chunks.push(slice);
    if (end === cleaned.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

async function embedWithOllama(text) {
  const { body, statusCode } = await request(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
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
  return (s || "")
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
  "yang", "dan", "atau", "di", "ke", "dari", "pada", "untuk", "dengan", "adalah", "itu", "ini",
  "dalam", "sebagai", "oleh", "agar", "bagi", "setiap", "akan", "dapat", "tidak", "harus",
  "kami", "kamu", "anda", "para", "jika", "maka", "saat", "ketika", "lebih", "kurang",
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
// Hybrid Retrieval Helper (reusable untuk multi-hop)
// =====================
async function hybridRetrieve(queryText, topK = 6) {
  // Vector search
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

  // BM25 search
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
  for (let i = 0; i < bm25Scored.length; i++) {
    keywordRank.set(bm25Scored[i].id, i + 1);
  }

  // RRF Fusion
  const fused = rrfFuse(vectorRank, keywordRank, 60);
  const fusedSorted = Array.from(fused.entries()).sort((a, b) => b[1] - a[1]).slice(0, topK);

  // Build payload map
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
// Query Decomposition untuk Multi-hop
// =====================
async function decomposeQuery(question) {
  const decomposePrompt = `Kamu adalah sistem pemecah pertanyaan untuk pencarian dokumen.
Tugasmu: ubah pertanyaan pengguna menjadi 4 sub-pertanyaan pencarian:
1) overview/definisi
2) detail/poin utama/langkah
3) batasan/syarat/pengecualian (aturan)
4) closure/kesimpulan/tindak lanjut (penutup)

ATURAN:
- Output HARUS JSON valid dengan kunci: "overview","detail","aturan","penutup"
- Tiap nilai adalah 1 kalimat tanya, bahasa Indonesia
- Jangan menambahkan fakta di luar pertanyaan pengguna
- Tetap fokus pada topik yang ditanyakan

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

    if (statusCode < 200 || statusCode >= 300) {
      return null;
    }

    const json = await body.json();
    const content = json?.message?.content || "";
    const parsed = safeJsonParse(content);

    if (parsed && parsed.overview && parsed.detail) {
      return {
        overview: String(parsed.overview || question).trim(),
        detail: String(parsed.detail || question).trim(),
        aturan: String(parsed.aturan || `Apa syarat atau batasan terkait ${question}?`).trim(),
        penutup: String(parsed.penutup || `Apa kesimpulan atau tindak lanjut terkait ${question}?`).trim(),
      };
    }
  } catch (err) {
    console.error("Decompose error:", err);
  }

  // Fallback: gunakan pertanyaan asli dengan variasi
  return {
    overview: `Apa definisi dan konteks umum tentang: ${question}`,
    detail: `Apa langkah-langkah atau poin utama terkait: ${question}`,
    aturan: `Apa syarat, batasan, atau pengecualian terkait: ${question}`,
    penutup: `Apa kesimpulan atau tindak lanjut yang disarankan terkait: ${question}`,
  };
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

function parseFourParts(rawText) {
  const raw = String(rawText || "").trim();

  const j = safeJsonParse(raw);
  if (j && typeof j === "object") {
    return {
      overview: String(j.overview || "").trim(),
      detail: String(j.detail || "").trim(),
      aturan: String(j.aturan || "").trim(),
      penutup: String(j.penutup || "").trim(),
    };
  }

  // fallback minimal jika JSON gagal total
  return {
    overview: "",
    detail: raw,
    aturan: "",
    penutup: "",
  };
}

function hasCitations(text) {
  // kita tetap prefer [#1], tapi toleran:
  const t = String(text || "");
  return /\[#\d+\]/.test(t) || /\[\d+\]/.test(t) || /#\d+/.test(t);
}

function isFourPartsFilled(a) {
  const o = String(a?.overview || "").trim();
  const d = String(a?.detail || "").trim();
  const r = String(a?.aturan || "").trim();
  const p = String(a?.penutup || "").trim();
  return o.length > 0 && d.length > 0 && r.length > 0 && p.length > 0;
}

function isNotFoundText(s) {
  return /tidak ditemukan di dokumen/i.test(String(s || ""));
}

function isNotFoundAnswer(a) {
  const all = `${a?.overview || ""} ${a?.detail || ""} ${a?.aturan || ""} ${a?.penutup || ""}`;
  return isNotFoundText(all);
}

// bersihkan meta-rule/policy yg sering bocor + inferensi + saran
function stripMetaRules(s) {
  let t = String(s || "").trim();
  if (!t) return "";

  // hapus kalimat meta, saran, inferensi
  const metaPatterns = [
    /jawaban/i,
    /chatbot/i,
    /context/i,
    /konteks/i,
    /policy/i,
    /instruksi/i,
    /aturan keras/i,
    /sistem/i,
    /prompt/i,
    /kami sarankan/i,
    /cari sumber lain/i,
    /sumber lain/i,
    /dapat disimpulkan/i,
    /kesimpulan/i,
    /inferensi/i,
    /berdasarkan isi dokumen/i,
    /dokumen ini hanya berisi/i,
    /teks yang berulang/i,
    /tidak memberikan informasi/i,
    /lebih relevan dan akurat/i,
  ];

  // split per kalimat, buang yang meta
  const parts = t.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((sent) => {
    const x = sent.trim();
    if (!x) return false;
    // buang kalau match salah satu pattern
    for (const p of metaPatterns) {
      if (p.test(x)) return false;
    }
    return true;
  });

  t = kept.join(" ").trim();

  // kalau jadi sangat pendek / cuma "Jawaban"
  if (/^(jawaban|aturan)\b/i.test(t) && t.length < 15) return "";
  return t;
}

// Deteksi klaim yang mengandung angka WAKTU spesifik tanpa sitasi (likely hallucination)
// Hanya block angka waktu karena itu paling sering halusinasi
function containsUnverifiedClaim(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (hasCitations(t)) return false; // sudah ada sitasi, OK
  if (isNotFoundText(t)) return false; // not found, OK

  // HANYA cek angka waktu spesifik (paling sering halusinasi)
  // Contoh: "14 hari", "2 minggu", "30 hari sebelum deadline"
  if (/\d+\s*(hari|minggu|bulan|tahun|jam)\s*(sebelum|setelah|kerja)?/i.test(t)) return true;

  return false;
}

function looksBrokenSentence(s) {
  const t = String(s || "").trim();
  if (!t) return true;

  // menggantung di akhir
  if (/(maka|yaitu|sehingga|karena|bahwa)\s*(\[#\d+\]|\[\d+\]|#\d+)?\s*$/i.test(t)) return true;

  // hanya sitasi doang
  if (/^(\s*(\[#\d+\]|\[\d+\]|#\d+)\s*)+$/i.test(t)) return true;

  // terlalu pendek tidak informatif
  if (t.length < 8) return true;

  return false;
}

// fallback citations: hanya dipakai kalau LLM benar-benar bandel
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

function finalizeAnswer(answerText) {
  let out = stripMetaRules(String(answerText || ""));

  // Jika ada klaim tanpa sitasi (angka spesifik, nama layanan), dan tidak ada sitasi di seluruh teks
  if (containsUnverifiedClaim(out) && !hasCitations(out)) {
    // Force tambahkan warning atau masked, tapi untuk unverified claim kita bisa biarkan lolos dengan caution jika dia panjang
    // Atau kita bisa reject. Untuk sekarang, kita coba sanitize sebisa mungkin.
    // Kalau benar-benar severe, kita replace dengan pesan error
    // Tapi karena user minta 'mengalir', kita percaya guardrail LLM prompt dulu.
    // containsUnverifiedClaim hanya cek angka waktu "14 hari" tanpa sitasi.
    // Kita bisa append disclaimer.
    out += "\n\n(Catatan: Beberapa klaim angka spesifik mungkin perlu verifikasi manual jika tidak disertai sitasi).";
  }

  if (!out) {
    return "Maaf, tidak ditemukan informasi yang relevan dalam dokumen.";
  }

  // Ensure citations in text?
  // ensureCitationsInText logic is tough on paragraphs. 
  // Let's assume prompt works better now.
  // We can force append citations if totally missing but documents were found? 
  // Nanti di route handler kita cek.

  return out;
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
    qdrant: { ok: true, collections_count: collections.collections?.length ?? 0 },
    ollama: { ok: true, models: (tags.models ?? []).map((m) => m.name) },
  };
});

/**
 * GET /docs
 * List all ingested documents with chunk counts
 */
app.get("/docs", async (req, reply) => {
  try {
    // Get all points to analyze source files
    const scroll = await qdrant.scroll(COLLECTION_NAME, {
      limit: 10000,
      with_payload: true,
      with_vector: false,
    });

    const points = scroll.points || [];

    // Group by source_file
    const docMap = new Map();
    for (const p of points) {
      const sourceFile = p.payload?.source_file || "unknown";
      if (!docMap.has(sourceFile)) {
        docMap.set(sourceFile, {
          source_file: sourceFile,
          chunks: 0,
          chunk_ids: [],
        });
      }
      const doc = docMap.get(sourceFile);
      doc.chunks++;
      doc.chunk_ids.push(p.id);
    }

    const docs = Array.from(docMap.values()).map((d, idx) => ({
      id: `doc-${idx + 1}`,
      source_file: d.source_file,
      chunks: d.chunks,
    }));

    return reply.send({
      ok: true,
      total_docs: docs.length,
      total_chunks: points.length,
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

app.post("/chat", async (req, reply) => {
  try {
    const body = req.body || {};
    const question = String(body.question || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!question) return reply.code(400).send({ ok: false, message: "question is required" });

    if (!keywordCache.points.length) await loadKeywordCache();

    // 1) VECTOR
    const qVec = await embedWithOllama(question);
    const vectorHits = await qdrant.search(COLLECTION_NAME, {
      vector: qVec,
      limit: 20,
      with_payload: true,
      with_vector: false,
    });

    const vectorRank = new Map();
    for (let i = 0; i < (vectorHits || []).length; i++) vectorRank.set(String(vectorHits[i].id), i + 1);

    // 2) KEYWORD
    const qToks = filterStopwords(tokenize(question));
    const { df, avgdl } = buildDfMapAndAvgdl(keywordCache.points);

    const bm25Scored = keywordCache.points
      .map((p) => {
        const docToks = filterStopwords(tokenize(p.payload.text));
        return { id: String(p.id), score: bm25Score(qToks, docToks, df, avgdl), payload: p.payload };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const keywordRank = new Map();
    for (let i = 0; i < bm25Scored.length; i++) keywordRank.set(bm25Scored[i].id, i + 1);

    // 3) FUSION
    const fused = rrfFuse(vectorRank, keywordRank, 60);
    const fusedSorted = Array.from(fused.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const idToPayload = new Map();
    for (const hit of vectorHits || []) idToPayload.set(String(hit.id), hit.payload);
    for (const hit of bm25Scored) idToPayload.set(String(hit.id), hit.payload);

    const contextChunks = fusedSorted
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

    if (contextChunks.length === 0) {
      return reply.send({
        ok: true,
        answer: {
          overview: "Tidak ditemukan di dokumen.",
          detail: "Tidak ditemukan di dokumen.",
          aturan: "Tidak ditemukan di dokumen.",
          penutup: "Tidak ditemukan di dokumen.",
        },
        sources: [],
      });
    }

    // CONTEXT: sitasi singkat
    const contextText = contextChunks.map((c, idx) => `[#${idx + 1}]\n${c.text}`).join("\n\n---\n\n");

    const system = `Kamu adalah asisten kampus berbasis dokumen.

ATURAN MUTLAK (STRICT):
1. SCOPE KAMPUS SAJA: Kamu hanya boleh menjawab hal-hal yang berkaitan dengan Dokumen Kampus UTN.
2. TOLAK TOKOH UMUM: Jika user bertanya tentang Presiden, Politik, Selebriti, atau Sejarah Umum yang TIDAK ADA di dokumen, JAWAB: "Maaf, topik ini di luar konteks dokumen kampus." (JANGAN GUNAKAN PENGETAHUAN LUAR).
3. JAWABAN TUNGGAL: Buat satu narasi padu ringkas.
4. JANGAN REPEAT: Jangan menulis ulang pertanyaan.
5. SITASI WAJIB: Akhiri setiap fakta dengan [#NOMOR].

Jika tidak ada di CONTEXT, katakan: "Tidak ditemukan informasi yang relevan di dokumen."`;

    const userPrompt = `PERTANYAAN:\n${question}\n\nCONTEXT:\n${contextText}`;

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

    // --- attempt 1 (LLM-first)
    const baseMessages = [
      { role: "system", content: system },
      ...history.slice(-6).map((m) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user", content: userPrompt },
    ];

    let raw = "";
    let answer = "";

    const chatJson1 = await ollamaChat(baseMessages, 0.2);
    raw = chatJson1?.message?.content || "";
    answer = finalizeAnswer(raw);

    // --- quality gate
    const needRetry1 = answer.length < 50 || (!hasCitations(answer) && !isNotFoundText(answer));

    if (needRetry1) {
      const repairMessages = [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
        {
          role: "user",
          content: 'PERBAIKI. Jawaban terlalu pendek atau kurang sitasi. Ulangi dengan jawaban lebih lengkap dan sertakan sitasi [#NOMOR].',
        },
      ];

      const chatJson2 = await ollamaChat(repairMessages, 0.1);
      raw = chatJson2?.message?.content || raw;
      answer = finalizeAnswer(raw);
    }

    // --- final fallback
    answer = ensureCitationsInText(answer);

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
 * Multi-hop RAG: decompose → 4x retrieval → merge → synthesize
 */
app.post("/chat-multihop", async (req, reply) => {
  try {
    const body = req.body || {};
    const question = String(body.question || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!question) return reply.code(400).send({ ok: false, message: "question is required" });

    if (!keywordCache.points.length) await loadKeywordCache();

    // 1) DECOMPOSE question → 4 sub-questions
    const subQueries = await decomposeQuery(question);
    console.log("Sub-queries:", subQueries);

    // 2) RETRIEVE per sub-question (parallel)
    const [overviewChunks, detailChunks, aturanChunks, penutupChunks] = await Promise.all([
      hybridRetrieve(subQueries.overview, 4),
      hybridRetrieve(subQueries.detail, 4),
      hybridRetrieve(subQueries.aturan, 4),
      hybridRetrieve(subQueries.penutup, 4),
    ]);

    // 3) MERGE & DEDUP chunks
    const seenIds = new Set();
    const allChunks = [];

    const addChunks = (chunks, hopName) => {
      for (const c of chunks) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          allChunks.push({ ...c, hop: hopName });
        }
      }
    };

    addChunks(overviewChunks, "overview");
    addChunks(detailChunks, "detail");
    addChunks(aturanChunks, "aturan");
    addChunks(penutupChunks, "penutup");

    // Track which hops found evidence
    const hopsFound = {
      overview: overviewChunks.length > 0,
      detail: detailChunks.length > 0,
      aturan: aturanChunks.length > 0,
      penutup: penutupChunks.length > 0,
    };

    if (allChunks.length === 0) {
      return reply.send({
        ok: true,
        answer: {
          overview: "Tidak ditemukan di dokumen.",
          detail: "Tidak ditemukan di dokumen.",
          aturan: "Tidak ditemukan di dokumen.",
          penutup: "Tidak ditemukan di dokumen.",
        },
        sources: [],
        debug: { hopsFound, subQueries },
      });
    }

    // 4) BUILD CONTEXT with hop labels
    const contextText = allChunks
      .map((c, idx) => `[#${idx + 1}] (${c.hop})\n${c.text}`)
      .join("\n\n---\n\n");

    // 5) SYNTHESIS PROMPT
    const system = `Kamu adalah asisten kampus Universitas Teknologi Nusantara (UTN).

ATURAN MUTLAK (STRICT):
1. SCOPE KAMPUS SAJA: Kamu hanya boleh menjawab hal-hal yang berkaitan dengan Dokumen Kampus UTN.
2. TOLAK TOKOH UMUM: Jika user bertanya tentang Presiden, Politik, Selebriti, atau Sejarah Umum yang TIDAK ADA di dokumen, JAWAB: "Maaf, topik ini di luar konteks dokumen kampus." (JANGAN GUNAKAN PENGETAHUAN LUAR).
3. JAWABAN TUNGGAL: Buat satu narasi padu ringkas.
4. JANGAN REPEAT: Jangan menulis ulang pertanyaan.
5. SITASI WAJIB: Akhiri setiap fakta dengan [#NOMOR].

Jika tidak ada di CONTEXT, katakan: "Tidak ditemukan informasi yang relevan di dokumen."`;

    const userPrompt = `PERTANYAAN:\n"${question}"\n\nCONTEXT:\n${contextText}\n\nINSTRUKSI: Jawab pertanyaan berdasarkan CONTEXT di atas. Jangan mengulang pertanyaan.`;

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

    // Call LLM
    const baseMessages = [
      { role: "system", content: system },
      ...history.slice(-6).map((m) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user", content: userPrompt },
    ];

    const chatJson = await ollamaChat(baseMessages, 0.2);
    let raw = chatJson?.message?.content || "";
    let answer = finalizeAnswer(raw);

    // Quality gate retry
    const needRetry = answer.length < 50 || (!hasCitations(answer) && !isNotFoundText(answer));

    if (needRetry) {
      const repairMessages = [
        { role: "system", content: system + "\n\nCRITICAL: JAWABAN TERLALU PENDEK ATAU KURANG SITASI. ULANGI DENGAN LEBIH LENGKAP DAN SERTAKAN SITASI [#]." },
        { role: "user", content: userPrompt },
      ];

      const chatJson2 = await ollamaChat(repairMessages, 0.1);
      raw = chatJson2?.message?.content || raw;
      answer = finalizeAnswer(raw);
    }

    // Force citations fallback
    answer = ensureCitationsInText(answer);

    return reply.send({
      ok: true,
      answer, // String
      sources: allChunks.map((c, i) => ({
        ref: `#${i + 1}`,
        id: c.source_file,
        source_file: c.source_file, // Fix: Frontend expects source_file
        chunk_index: c.chunk_index, // Fix: Frontend expects chunk_index
        hop: c.hop,
        text: c.text,
        refId: i + 1,
        fused_score: c.score || 0,
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
  console.log("Server running on http://localhost:3001");
});
