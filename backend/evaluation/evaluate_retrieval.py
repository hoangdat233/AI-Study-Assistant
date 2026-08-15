"""Retrieval Quality & Distance Diagnostic Evaluator for AI Study Assistant RAG.

Measures Hit@K, Recall@K, MRR, Cosine Distance Distributions, and Top-K trade-offs.
"""

from dataclasses import dataclass
import json
from pathlib import Path
import statistics
import time
from typing import Any

from app.ai.embedding import BaseEmbeddingProvider, MockEmbeddingProvider, get_embedding_provider
from app.services.indexing_service import DocumentChunker, ParsedChunk


@dataclass
class RetrievalMetricResult:
    k: int
    hit_rate: float
    mean_recall: float
    mrr: float
    avg_retrieval_ms: float


def load_dataset(dataset_path: Path) -> list[dict[str, Any]]:
    with open(dataset_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_sample_document(doc_path: Path) -> str:
    with open(doc_path, "r", encoding="utf-8") as f:
        return f.read()


def cosine_distance(vec_a: list[float], vec_b: list[float]) -> float:
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = sum(a * a for a in vec_a) ** 0.5
    norm_b = sum(b * b for b in vec_b) ** 0.5
    if not norm_a or not norm_b:
        return 1.0
    similarity = dot / (norm_a * norm_b)
    return max(0.0, min(2.0, 1.0 - similarity))


class RetrievalEvaluator:
    """Offline Retrieval Evaluator running standalone semantic vector search with persistent caching."""

    def __init__(
        self,
        document_text: str,
        chunker: DocumentChunker | None = None,
        embedding_provider: BaseEmbeddingProvider | None = None,
        cache_file: Path | None = None,
    ) -> None:
        self.chunker = chunker or DocumentChunker()
        self.provider = embedding_provider or get_embedding_provider()
        self.cache_file = cache_file or Path(__file__).resolve().parent / "embedding_cache.json"
        self._cache: dict[str, list[float]] = {}
        self._load_cache()

        self.chunks: list[ParsedChunk] = self.chunker.chunk_document(document_text)
        self.chunk_embeddings: list[list[float]] = [
            self._get_embedding(c.content) for c in self.chunks
        ]
        self._save_cache()

    def _load_cache(self) -> None:
        if self.cache_file.exists():
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    self._cache = json.load(f)
            except Exception:
                self._cache = {}

    def _save_cache(self) -> None:
        try:
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self._cache, f)
        except Exception:
            pass

    def _get_embedding(self, text: str) -> list[float]:
        if text not in self._cache:
            self._cache[text] = self.provider.embed_text(text)
            self._save_cache()
        return self._cache[text]

    def retrieve(self, query: str, top_k: int = 4) -> tuple[list[dict[str, Any]], float]:
        t0 = time.perf_counter()
        query_vec = self._get_embedding(query)
        scores: list[dict[str, Any]] = []

        for idx, (chunk, chunk_vec) in enumerate(zip(self.chunks, self.chunk_embeddings)):
            dist = cosine_distance(query_vec, chunk_vec)
            scores.append(
                {
                    "chunk_index": chunk.chunk_index,
                    "page_number": chunk.page_number or 1,
                    "content": chunk.content,
                    "distance": round(dist, 4),
                }
            )

        scores.sort(key=lambda x: x["distance"])
        elapsed_ms = (time.perf_counter() - t0) * 1000
        return scores[:top_k], elapsed_ms

    def evaluate_k_metrics(
        self, dataset: list[dict[str, Any]], k_values: list[int] = [2, 4, 6, 8]
    ) -> dict[int, RetrievalMetricResult]:
        answerable_items = [item for item in dataset if item.get("answerable", True)]
        results: dict[int, RetrievalMetricResult] = {}

        for k in k_values:
            hits: list[int] = []
            recalls: list[float] = []
            reciprocal_ranks: list[float] = []
            latencies: list[float] = []

            for item in answerable_items:
                query = item["question"]
                expected_pages = set(item["expected_pages"])
                retrieved, elapsed_ms = self.retrieve(query, top_k=k)
                latencies.append(elapsed_ms)

                retrieved_pages = [r["page_number"] for r in retrieved]
                retrieved_page_set = set(retrieved_pages)

                # Hit@K: Did at least one expected page appear in top-k?
                is_hit = 1 if (expected_pages & retrieved_page_set) else 0
                hits.append(is_hit)

                # Recall@K: Proportion of expected pages retrieved in top-k
                if expected_pages:
                    recall = len(expected_pages & retrieved_page_set) / len(expected_pages)
                else:
                    recall = 1.0
                recalls.append(recall)

                # MRR (Mean Reciprocal Rank): 1 / rank of first relevant page found
                rr = 0.0
                for rank, p in enumerate(retrieved_pages, start=1):
                    if p in expected_pages:
                        rr = 1.0 / rank
                        break
                reciprocal_ranks.append(rr)

            results[k] = RetrievalMetricResult(
                k=k,
                hit_rate=round(sum(hits) / len(hits), 4) if hits else 0.0,
                mean_recall=round(sum(recalls) / len(recalls), 4) if recalls else 0.0,
                mrr=round(sum(reciprocal_ranks) / len(reciprocal_ranks), 4) if reciprocal_ranks else 0.0,
                avg_retrieval_ms=round(statistics.mean(latencies), 2) if latencies else 0.0,
            )

        return results

    def compute_distance_diagnostics(
        self, dataset: list[dict[str, Any]], top_k: int = 4
    ) -> list[dict[str, Any]]:
        diagnostics: list[dict[str, Any]] = []

        for item in dataset:
            query = item["question"]
            is_answerable = item.get("answerable", True)
            expected_pages = item.get("expected_pages", [])
            retrieved, _ = self.retrieve(query, top_k=top_k)

            distances = [r["distance"] for r in retrieved]
            best_dist = distances[0] if distances else 1.0
            retrieved_pages = [r["page_number"] for r in retrieved]

            diagnostics.append(
                {
                    "id": item["id"],
                    "question": query,
                    "category": item.get("category", "general"),
                    "answerable": is_answerable,
                    "expected_pages": expected_pages,
                    "retrieved_pages": retrieved_pages,
                    "best_distance": best_dist,
                    "all_distances": distances,
                }
            )

        return diagnostics


def run_evaluation_cli() -> None:
    base_dir = Path(__file__).resolve().parent
    dataset_path = base_dir / "rag_dataset.json"
    doc_path = base_dir / "sample_document.txt"

    dataset = load_dataset(dataset_path)
    document_text = load_sample_document(doc_path)

    # Initialize evaluator
    evaluator = RetrievalEvaluator(document_text)

    print("=" * 80)
    print("AI STUDY ASSISTANT — RAG RETRIEVAL EVALUATION REPORT")
    print("=" * 80)
    print(f"Evaluation Dataset Size : {len(dataset)} questions ({sum(1 for d in dataset if d['answerable'])} answerable, {sum(1 for d in dataset if not d['answerable'])} out-of-domain)")
    print(f"Document Chunks Indexed : {len(evaluator.chunks)} chunks (400 words target, 80 words overlap)")
    print(f"Embedding Dimensions    : 3072 dims\n")

    # Step 3 & Step 6: Retrieval metrics across K
    print("-" * 80)
    print("1. RETRIEVAL METRICS ACROSS TOP-K (Hit@K, Recall@K, MRR)")
    print("-" * 80)
    k_metrics = evaluator.evaluate_k_metrics(dataset, k_values=[2, 4, 6, 8])
    print(f"{'K':<5} | {'Hit@K':<10} | {'Recall@K':<12} | {'MRR':<10} | {'Latency (ms)':<15}")
    print("-" * 60)
    for k, res in k_metrics.items():
        print(f"{res.k:<5} | {res.hit_rate:<10.2%} | {res.mean_recall:<12.2%} | {res.mrr:<10.4f} | {res.avg_retrieval_ms:<15.2f}")

    # Step 4: Distance Diagnostics
    print("\n" + "-" * 80)
    print("2. COSINE DISTANCE DIAGNOSTICS")
    print("-" * 80)
    diagnostics = evaluator.compute_distance_diagnostics(dataset, top_k=4)

    answerable_dists = [d["best_distance"] for d in diagnostics if d["answerable"]]
    unanswerable_dists = [d["best_distance"] for d in diagnostics if not d["answerable"]]

    print(f"Answerable Queries (N={len(answerable_dists)}):")
    print(f"  - Min Distance  : {min(answerable_dists):.4f}")
    print(f"  - Mean Distance : {statistics.mean(answerable_dists):.4f}")
    print(f"  - Max Distance  : {max(answerable_dists):.4f}")
    print(f"  - Std Dev       : {statistics.stdev(answerable_dists):.4f}")

    print(f"\nUnanswerable / Out-of-Domain Queries (N={len(unanswerable_dists)}):")
    print(f"  - Min Distance  : {min(unanswerable_dists):.4f}")
    print(f"  - Mean Distance : {statistics.mean(unanswerable_dists):.4f}")
    print(f"  - Max Distance  : {max(unanswerable_dists):.4f}")
    print(f"  - Std Dev       : {statistics.stdev(unanswerable_dists):.4f}")

    # Step 7: Chunking parameter comparison
    print("\n" + "-" * 80)
    print("3. CHUNKING CONFIGURATION SWEEP (Hit@4 comparison)")
    print("-" * 80)
    configs = [
        (300, 60, "300 words / 60 overlap (Fine-grained)"),
        (400, 80, "400 words / 80 overlap (Current Default)"),
        (500, 100, "500 words / 100 overlap (Coarse-grained)"),
    ]
    for target, overlap, label in configs:
        sweep_chunker = DocumentChunker()
        sweep_eval = RetrievalEvaluator(document_text, chunker=sweep_chunker)
        # Re-chunk with specific config
        sweep_eval.chunks = sweep_chunker.chunk_document(document_text, target_words=target, overlap_words=overlap)
        sweep_eval.chunk_embeddings = sweep_eval.provider.embed_texts([c.content for c in sweep_eval.chunks])
        m = sweep_eval.evaluate_k_metrics(dataset, k_values=[4])[4]
        print(f"{label:<45} -> Chunks: {len(sweep_eval.chunks):<3} | Hit@4: {m.hit_rate:.2%} | Recall@4: {m.mean_recall:.2%} | MRR: {m.mrr:.4f}")

    print("=" * 80)


if __name__ == "__main__":
    run_evaluation_cli()
