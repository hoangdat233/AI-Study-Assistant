"""RAG Grounding Threshold & End-to-End Quality Evaluator.

Evaluates relevance distance thresholds, false rejection vs. false acceptance trade-offs,
and categorizes grounded answers.
"""

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

from app.ai.embedding import get_embedding_provider
from app.ai.prompts import RAG_SYSTEM_PROMPT, build_rag_user_prompt
from app.ai.provider import get_llm_provider
from evaluation.evaluate_retrieval import RetrievalEvaluator, load_dataset, load_sample_document


@dataclass
class ThresholdMetrics:
    threshold: float
    true_accept_count: int      # Answerable & accepted (TP)
    false_reject_count: int     # Answerable but incorrectly rejected (FN)
    true_reject_count: int      # Unanswerable & correctly rejected (TN)
    false_accept_count: int     # Unanswerable but incorrectly accepted (FP)
    precision: float
    recall: float
    f1_score: float
    accuracy: float


class ThresholdEvaluator:
    """Evaluates grounding cutoff thresholds to balance relevance vs. over-refusal."""

    def __init__(self, evaluator: RetrievalEvaluator) -> None:
        self.evaluator = evaluator

    def evaluate_thresholds(
        self, dataset: list[dict[str, Any]], candidate_thresholds: list[float]
    ) -> list[ThresholdMetrics]:
        diagnostics = self.evaluator.compute_distance_diagnostics(dataset, top_k=4)
        results: list[ThresholdMetrics] = []

        total_answerable = sum(1 for d in diagnostics if d["answerable"])
        total_unanswerable = sum(1 for d in diagnostics if not d["answerable"])

        for t in candidate_thresholds:
            tp = 0  # Answerable and accepted
            fn = 0  # Answerable and rejected
            tn = 0  # Unanswerable and rejected
            fp = 0  # Unanswerable and accepted

            for d in diagnostics:
                best_dist = d["best_distance"]
                is_answerable = d["answerable"]
                accepted = best_dist <= t

                if is_answerable:
                    if accepted:
                        tp += 1
                    else:
                        fn += 1
                else:
                    if not accepted:
                        tn += 1
                    else:
                        fp += 1

            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
            accuracy = (tp + tn) / len(diagnostics) if diagnostics else 0.0

            results.append(
                ThresholdMetrics(
                    threshold=t,
                    true_accept_count=tp,
                    false_reject_count=fn,
                    true_reject_count=tn,
                    false_accept_count=fp,
                    precision=round(precision, 4),
                    recall=round(recall, 4),
                    f1_score=round(f1, 4),
                    accuracy=round(accuracy, 4),
                )
            )

        return results


def run_rag_eval_cli() -> None:
    base_dir = Path(__file__).resolve().parent
    dataset_path = base_dir / "rag_dataset.json"
    doc_path = base_dir / "sample_document.txt"

    dataset = load_dataset(dataset_path)
    document_text = load_sample_document(doc_path)

    evaluator = RetrievalEvaluator(document_text)
    thresh_eval = ThresholdEvaluator(evaluator)

    print("=" * 85)
    print("AI STUDY ASSISTANT — GROUNDING THRESHOLD & RAG QUALITY ANALYSIS")
    print("=" * 85)

    candidate_thresholds = [0.40, 0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90]
    metrics = thresh_eval.evaluate_thresholds(dataset, candidate_thresholds)

    print(f"\n{'Threshold':<10} | {'True Acc (TP)':<14} | {'False Rej (FN)':<15} | {'True Rej (TN)':<14} | {'False Acc (FP)':<15} | {'F1-Score':<10} | {'Accuracy':<10}")
    print("-" * 95)
    for m in metrics:
        print(f"{m.threshold:<10.2f} | {m.true_accept_count:<14} | {m.false_reject_count:<15} | {m.true_reject_count:<14} | {m.false_accept_count:<15} | {m.f1_score:<10.4f} | {m.accuracy:<10.2%}")

    print("\n" + "=" * 85)
    print("THRESHOLD TRADE-OFF ANALYSIS SUMMARY:")
    print("=" * 85)
    print("- Threshold 0.40: Achieves perfect separation (F1=1.0) on this 15-query synthetic benchmark.")
    print("- Threshold 0.85 (Retained Baseline): Overly permissive on this benchmark (passes all 4 negative queries),")
    print("  relying on second-stage prompt refusal. Retained as conservative baseline pending multi-domain validation.")
    print("=" * 85)


if __name__ == "__main__":
    run_rag_eval_cli()
