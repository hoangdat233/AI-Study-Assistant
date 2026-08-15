# RAG Evaluation & Performance Engineering Report

This document presents the quantitative evaluation, retrieval quality metrics, distance threshold diagnostics, and latency telemetry for the **AI Study Assistant** Retrieval-Augmented Generation (RAG) subsystem.

---

## 1. System Configuration & Architecture

| Parameter | Configuration | Technical Role / Description |
|---|---|---|
| **Embedding Model** | `gemini-embedding-001` (Google AI Studio) | High-semantic density vector representations |
| **Vector Dimension** | **3,072 dimensions** | Dense vector representations for academic text |
| **Chunking Strategy** | **400 words target / 80 words overlap** | Retained baseline configuration with `[Page N]` boundary markers |
| **Distance Metric** | **Cosine Distance** (`<=>` in pgvector) | Scale-invariant angular distance |
| **Retrieval Top-K** | **$K = 4$** | Standard baseline balancing context coverage and prompt size |
| **Grounding Cutoff** | **Cosine Distance $\le 0.85$** | Retained conservative baseline threshold (first-stage vector guard) |
| **Citation Schema** | Authoritative DB Chunks | UI deduplication per page with exact chunk provenance |

---

## 2. Evaluation Methodology & Dataset

We developed a dedicated, standalone evaluation framework (`backend/evaluation/`) consisting of:
- **Reference Corpus**: A multi-page technical document covering Machine Learning, Deep Learning, Transformer Attention, RAG Pipelines, and PostgreSQL pgvector system architectures (`sample_document.txt`).
- **Benchmark Dataset (`rag_dataset.json`)**: 15 curated query scenarios:
  1. *Factual Lookups* (Single-page target facts)
  2. *Paraphrased Inquiries* (Queries using vocabulary distinct from source text)
  3. *Cross-Page Syntheses* (Queries spanning concepts across multiple pages)
  4. *Out-of-Domain / Unanswerable Inquiries* (Negative controls testing refusal capabilities)

---

## 3. Empirical Retrieval Metrics

Retrieval quality was measured independently from generation across candidate $K \in \{2, 4, 6, 8\}$:

| Top-K ($K$) | Hit@K (%) | Recall@K (%) | MRR (Mean Reciprocal Rank) | Retrieval Latency (ms) |
|---|---|---|---|---|
| **$K = 2$** | **100.00%** | **100.00%** | **1.0000** | ~3.5 ms |
| **$K = 4$ (Baseline)** | **100.00%** | **100.00%** | **1.0000** | **~3.4 ms** |
| **$K = 6$** | **100.00%** | **100.00%** | **1.0000** | ~3.3 ms |
| **$K = 8$** | **100.00%** | **100.00%** | **1.0000** | ~3.1 ms |

> **Definitions**:
> - **Hit@K**: Percentage of queries where at least one ground-truth expected page was retrieved in the top-$K$ chunks.
> - **Recall@K**: Proportion of all expected reference pages captured within top-$K$.
> - **MRR**: $\frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\text{rank}_i}$ of the first relevant reference chunk.

---

## 4. Cosine Distance Distribution Diagnostics

To evaluate the relevance cutoff threshold, we measured the cosine distance distributions between answerable and out-of-domain queries:

```
Answerable Queries (N=11):
  Min Distance  : 0.2288
  Mean Distance : 0.2664
  Max Distance  : 0.3298
  Std Deviation : 0.0327

Unanswerable / Out-of-Domain Queries (N=4):
  Min Distance  : 0.4690
  Mean Distance : 0.5189
  Max Distance  : 0.5505
  Std Deviation : 0.0349
```

### Key Observation:
On this 15-query dataset, there is a clear semantic gap ($\Delta \approx 0.14$) between the maximum answerable query distance ($0.3298$) and the minimum out-of-domain query distance ($0.4690$).

---

## 5. Threshold Analysis (False Rejections vs. False Acceptances)

We evaluated candidate relevance cutoff thresholds to analyze the trade-off between **False Rejections (FRR)** and **False Acceptances (FAR)**:

| Threshold | True Accept (TP) | False Reject (FN) | True Reject (TN) | False Accept (FP) | F1-Score | Accuracy |
|---|---|---|---|---|---|---|
| `0.40` | 11 | 0 | 4 | 0 | **1.0000** | **100.00%** |
| `0.50` | 11 | 0 | 3 | 1 | **0.9565** | 93.33% |
| `0.60` | 11 | 0 | 0 | 4 | 0.8462 | 73.33% |
| `0.70` | 11 | 0 | 0 | 4 | 0.8462 | 73.33% |
| `0.85` *(Baseline)* | 11 | 0 | 0 | 4 | 0.8462 | 73.33% |

### Accurate Interpretation & Decision:
- **Benchmark Observation**: On this specific 15-query dataset, threshold `0.40` achieved perfect separation ($\text{F1} = 1.0$), while the current threshold `0.85` allowed all 4 out-of-domain queries to pass the vector guard (since max negative distance was $0.5505 \le 0.85$), relying entirely on the second-stage prompt instruction for refusal.
- **Production Rationale**: Threshold `0.85` is **not claimed to be optimal**; on the current small benchmark, it appears overly permissive at the vector guard stage. However, because a 15-query synthetic dataset is too small to justify a production parameter change, `0.85` is **retained as the existing conservative baseline** pending validation on a larger, more diverse corpus across multiple domains and languages.

---

## 6. Chunking Configuration Sweep

We evaluated alternative chunking window configurations:

| Chunking Configuration | Chunks Generated | Hit@4 | Recall@4 | MRR | Observation |
|---|---|---|---|---|---|
| **300 words / 60 overlap** | 5 | 100.00% | 100.00% | 1.0000 | Identical retrieval metrics on small reference text |
| **400 words / 80 overlap (Baseline)** | **5** | **100.00%** | **100.00%** | **1.0000** | **Retained baseline configuration** |
| **500 words / 100 overlap** | 5 | 100.00% | 100.00% | 1.0000 | Identical retrieval metrics on small reference text |

### Chunking Decision:
The evaluation showed identical Hit@4 and MRR across all three tested configurations (300/60, 400/80, 500/100). The small evaluation dataset **did not demonstrate a statistically meaningful retrieval advantage** for any tested chunk configuration. Therefore, **400 words / 80 words overlap is retained as the baseline configuration**.

---

## 7. Performance & Latency Telemetry

Measured on production backend with monotonic timers (`time.perf_counter()`):

| Stage | Monitored Operation | Typical Duration |
|---|---|---|
| **1. Embedding** | Query embedding generation (`gemini-embedding-001`) | ~800 – 1,200 ms |
| **2. Vector Retrieval** | `pgvector` filtered cosine distance search ($K=4$) | **~3 – 8 ms** |
| **3. LLM Generation** | Gemini text generation (`gemini-flash-latest` / `lite`) | ~1,200 – 2,500 ms |
| **End-to-End Request** | Total roundtrip time | ~2.0 – 3.8 seconds |

---

## 8. Database Index Audit & Decision Log

- **Relational B-Tree Indexes**: `documents(user_id)`, `document_chunks(document_id, chunk_index)`, `chats(document_id)`, `quiz_attempts(user_id)`.
- **Vector Search Strategy**: For typical academic PDFs (5–100 chunks per document), **Exact Scan (Flat)** over the `document_id` filtered subset executes in **< 5ms** with **100% recall**, completely avoiding the indexing overhead, memory footprint, and recall degradation of approximate nearest neighbors (ANN/HNSW).

---

## 9. Reproducibility

To re-run the complete evaluation suite locally:

```bash
# 1. Activate backend environment
cd backend
.\.venv\Scripts\activate

# 2. Run retrieval quality evaluation
python -m evaluation.evaluate_retrieval

# 3. Run grounding threshold analysis
python -m evaluation.evaluate_rag

# 4. Run automated test suite
pytest tests/ -v
```
