# TODO 6: Riset Evaluasi RAG

## Deskripsi
Cari dan pelajari metode evaluasi untuk RAG system.

---

## Framework Evaluasi RAG

### 1. RAGAS (Recommended)
**Repository:** https://github.com/explodinggradients/ragas

**Metrik:**
| Metrik | Deskripsi |
|--------|-----------|
| Faithfulness | Apakah jawaban faithful terhadap context |
| Answer Relevancy | Apakah jawaban relevan dengan pertanyaan |
| Context Precision | Presisi chunk yang di-retrieve |
| Context Recall | Recall informasi penting |

### 2. Evaluasi Manual
Yang sudah dilakukan:
- 20 pertanyaan test
- 100% akurasi

### 3. Metrik Retrieval
| Metrik | Formula |
|--------|---------|
| Precision@K | (Relevant retrieved) / K |
| Recall | (Retrieved) / (Should retrieve) |
| MRR | Mean Reciprocal Rank |

---

## Yang Perlu Dilakukan

### Step 1: Buat Ground Truth Dataset
```json
[
  {
    "question": "Apa syarat yudisium?",
    "ground_truth": "Syarat yudisium adalah...",
    "relevant_chunks": ["chunk_1", "chunk_5"]
  }
]
```

### Step 2: Implementasi Evaluasi
```javascript
async function evaluate(question, groundTruth) {
  const result = await fetch("/chat-multihop", {
    body: JSON.stringify({ question })
  });
  
  // Hitung faithfulness
  const faithfulness = calculateFaithfulness(result.answer, result.sources);
  
  // Hitung relevancy
  const relevancy = calculateRelevancy(result.answer, question);
  
  return { faithfulness, relevancy };
}
```

### Step 3: Run Batch Evaluation
```javascript
for (const test of groundTruthDataset) {
  const scores = await evaluate(test.question, test.ground_truth);
  results.push(scores);
}

// Hitung average
const avgFaithfulness = results.reduce((a, b) => a + b.faithfulness, 0) / results.length;
```

---

## Resources untuk Riset

1. **Paper:** "RAGAS: Automated Evaluation of Retrieval Augmented Generation"
2. **Paper:** "Evaluating RAG Systems: A Comprehensive Guide"
3. **GitHub:** explodinggradients/ragas

---

## Checklist

- [ ] Baca paper tentang evaluasi RAG
- [ ] Buat ground truth dataset (10-20 pertanyaan)
- [ ] Implementasi metrik faithfulness
- [ ] Implementasi metrik relevancy
- [ ] Run batch evaluation
- [ ] Dokumentasikan hasil
