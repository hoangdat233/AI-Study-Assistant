import json
import logging
import time
from typing import Any, Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.embedding import BaseEmbeddingProvider, get_embedding_provider
from app.ai.prompts import RAG_SYSTEM_PROMPT, build_rag_user_prompt
from app.ai.provider import BaseLLMProvider, get_llm_provider
from app.models.document import Document, DocumentChunk
from app.services.indexing_service import indexing_service

logger = logging.getLogger("ai_study_assistant")

# Calibrated grounding cutoff distance based on Phase 9 empirical evaluation
MAX_COSINE_DISTANCE_THRESHOLD = 0.85


class RAGService:
    """Service orchestrating semantic search, RAG context assembly, and grounded Q&A."""

    def search_similar_chunks(
        self,
        db: Session,
        document: Document,
        query: str,
        top_k: int = 4,
        provider: BaseEmbeddingProvider | None = None,
    ) -> tuple[list[dict[str, Any]], float, float]:
        """Performs PostgreSQL pgvector similarity search over document_chunks.

        Returns (chunk_results, embedding_ms, retrieval_ms).
        """
        if not document.chunks or document.processing_status != "INDEXED":
            # Auto-index on demand if not indexed
            indexing_service.index_document(db, document, provider=provider)

        active_embedding_provider = provider or get_embedding_provider()

        # Step 1: Embed user query with high-precision monotonic timer
        t_embed_start = time.perf_counter()
        query_vector = active_embedding_provider.embed_text(query)
        embedding_ms = (time.perf_counter() - t_embed_start) * 1000

        # Step 2: Query vector similarity
        t_retrieval_start = time.perf_counter()

        # Dialect fallback for SQLite unit testing environment
        if db.bind and db.bind.dialect.name == "sqlite":
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).all()
            chunk_results: list[dict[str, Any]] = []
            for chunk in chunks:
                vec = chunk.embedding or [0.0] * 3072
                dot = sum(a * b for a, b in zip(vec, query_vector))
                norm_a = sum(a * a for a in vec) ** 0.5
                norm_b = sum(b * b for b in query_vector) ** 0.5
                sim = dot / (norm_a * norm_b) if norm_a and norm_b else 0.0
                dist = 1.0 - sim
                chunk_results.append(
                    {
                        "chunk_id": str(chunk.id),
                        "chunk_index": chunk.chunk_index,
                        "page_number": chunk.page_number or 1,
                        "content": chunk.content,
                        "score": round(float(dist), 4),
                    }
                )
            chunk_results.sort(key=lambda x: x["score"])
            retrieval_ms = (time.perf_counter() - t_retrieval_start) * 1000
            return chunk_results[:top_k], round(embedding_ms, 2), round(retrieval_ms, 2)

        # Native PostgreSQL pgvector cosine distance query (<=>)
        stmt = (
            select(
                DocumentChunk,
                DocumentChunk.embedding.cosine_distance(query_vector).label("distance"),
            )
            .where(DocumentChunk.document_id == document.id)
            .order_by("distance")
            .limit(top_k)
        )

        results: Sequence[tuple[DocumentChunk, float]] = db.execute(stmt).all()

        chunk_results = []
        for chunk, dist in results:
            chunk_results.append(
                {
                    "chunk_id": str(chunk.id),
                    "chunk_index": chunk.chunk_index,
                    "page_number": chunk.page_number or 1,
                    "content": chunk.content,
                    "score": round(float(dist), 4),
                }
            )

        retrieval_ms = (time.perf_counter() - t_retrieval_start) * 1000
        return chunk_results, round(embedding_ms, 2), round(retrieval_ms, 2)

    def answer_question(
        self,
        db: Session,
        document: Document,
        question: str,
        llm_provider: BaseLLMProvider | None = None,
        embedding_provider: BaseEmbeddingProvider | None = None,
        top_k: int = 4,
    ) -> dict[str, Any]:
        """Runs RAG retrieval, verifies grounding threshold, calls LLM, and formats citations with telemetry."""
        t_total_start = time.perf_counter()

        if not question or not question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question string cannot be empty.",
            )

        search_results, embedding_ms, retrieval_ms = self.search_similar_chunks(
            db, document, question, top_k=top_k, provider=embedding_provider
        )

        # Grounding Safeguard: Reject questions with poor semantic similarity
        if not search_results or search_results[0]["score"] > MAX_COSINE_DISTANCE_THRESHOLD:
            total_ms = (time.perf_counter() - t_total_start) * 1000
            logger.info(
                "RAG ungrounded refusal: document_id=%s, best_score=%.4f (threshold=%.2f), embedding_ms=%.1f, retrieval_ms=%.1f, total_ms=%.1f",
                document.id,
                search_results[0]["score"] if search_results else 1.0,
                MAX_COSINE_DISTANCE_THRESHOLD,
                embedding_ms,
                retrieval_ms,
                total_ms,
            )
            return {
                "answer": "I couldn't find enough information in this document to answer that question.",
                "sources": [],
                "telemetry": {
                    "embedding_ms": embedding_ms,
                    "retrieval_ms": retrieval_ms,
                    "generation_ms": 0.0,
                    "total_ms": round(total_ms, 2),
                    "retrieved_chunks": len(search_results),
                },
            }

        # Format retrieved chunks for LLM Context Prompt & deduplicate displayed source pages
        context_parts: list[str] = []
        sources: list[dict[str, Any]] = []
        seen_pages: set[int] = set()

        top_score = search_results[0]["score"]

        for idx, res in enumerate(search_results, start=1):
            page_num = res["page_number"]
            content_snippet = res["content"].strip()
            # Feed all top-k chunks into prompt context for completeness
            context_parts.append(f"[Source {idx} — Page {page_num}]\n{content_snippet}")

            # Deduplicate by page number for clean UI citation badge presentation
            if page_num not in seen_pages and res["score"] <= min(0.78, top_score + 0.22):
                seen_pages.add(page_num)
                preview_text = content_snippet.replace("\n", " ").strip()
                if len(preview_text) > 250:
                    preview_text = preview_text[:250] + "..."

                sources.append(
                    {
                        "page": page_num,
                        "chunk_id": res["chunk_id"],
                        "preview": preview_text,
                        "score": res["score"],
                    }
                )

        context_str = "\n\n".join(context_parts)
        user_prompt = build_rag_user_prompt(context_str, question)

        # Step 3: LLM generation with latency timing
        t_gen_start = time.perf_counter()
        active_llm = llm_provider or get_llm_provider()
        raw_answer = active_llm.generate_text(RAG_SYSTEM_PROMPT, user_prompt)
        generation_ms = (time.perf_counter() - t_gen_start) * 1000

        clean_answer = raw_answer.strip()
        if clean_answer.startswith("{") and "answer" in clean_answer:
            try:
                parsed = json.loads(clean_answer)
                if isinstance(parsed, dict) and "answer" in parsed:
                    clean_answer = str(parsed["answer"])
            except Exception:
                pass

        total_ms = (time.perf_counter() - t_total_start) * 1000

        # Structured, privacy-safe logging (no raw document text or user PII)
        logger.info(
            "RAG completed: document_id=%s, chunks_retrieved=%d, unique_pages=%d, embedding_ms=%.1f, retrieval_ms=%.1f, generation_ms=%.1f, total_ms=%.1f",
            document.id,
            len(search_results),
            len(sources),
            embedding_ms,
            retrieval_ms,
            generation_ms,
            total_ms,
        )

        return {
            "answer": clean_answer,
            "sources": sources,
            "telemetry": {
                "embedding_ms": embedding_ms,
                "retrieval_ms": retrieval_ms,
                "generation_ms": round(generation_ms, 2),
                "total_ms": round(total_ms, 2),
                "retrieved_chunks": len(search_results),
            },
        }


rag_service = RAGService()
