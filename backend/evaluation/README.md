# RAG Evaluation Framework — AI Study Assistant

A lightweight, reproducible evaluation harness measuring retrieval quality, relevance cutoff thresholds, and grounding precision for the AI Study Assistant.

## Structure

```
backend/evaluation/
├── sample_document.txt     # Public synthetic reference document (5 pages)
├── rag_dataset.json        # Curated benchmark dataset (15 test queries)
├── evaluate_retrieval.py   # Hit@K, Recall@K, MRR & distance diagnostic runner
├── evaluate_rag.py         # Relevance threshold sweep & classification metrics
└── README.md               # Guide and execution instructions
```

## Running the Evaluation

To run the offline retrieval evaluation:

```bash
cd backend
python -m evaluation.evaluate_retrieval
```

To run the threshold classification analysis:

```bash
cd backend
python -m evaluation.evaluate_rag
```

## Metrics Measured

1. **Hit@K**: Measures whether at least one ground-truth expected page was retrieved in the top-$K$ chunks.
2. **Recall@K**: Proportion of total expected reference pages retrieved in top-$K$.
3. **MRR (Mean Reciprocal Rank)**: $1 / \text{rank}$ of the first relevant reference page in retrieved results.
4. **False Rejection Rate (FRR)**: Answerable user queries that are incorrectly refused due to an overly strict distance threshold.
5. **False Acceptance Rate (FAR)**: Out-of-domain / ungrounded queries that bypass the threshold and get sent to the LLM.
