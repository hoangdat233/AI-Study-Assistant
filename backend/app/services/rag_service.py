import json
from typing import Any, Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.embedding import BaseEmbeddingProvider, get_embedding_provider
from app.ai.prompts import RAG_SYSTEM_PROMPT, build_rag_user_prompt
from app.ai.provider import BaseLLMProvider, get_llm_provider
from app.models.document import Document, DocumentChunk
from app.services.indexing_service import indexing_service

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
    ) -> list[dict[str, Any]]:
        """Performs PostgreSQL pgvector similarity search over document_chunks."""
        if not document.chunks or document.processing_status != "INDEXED":
            # Auto-index on demand if not indexed
            indexing_service.index_document(db, document, provider=provider)

        active_embedding_provider = provider or get_embedding_provider()
        query_vector = active_embedding_provider.embed_text(query)

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
            return chunk_results[:top_k]

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

        chunk_results: list[dict[str, Any]] = []
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

        return chunk_results


    def answer_question(
        self,
        db: Session,
        document: Document,
        question: str,
        llm_provider: BaseLLMProvider | None = None,
        embedding_provider: BaseEmbeddingProvider | None = None,
        top_k: int = 4,
    ) -> dict[str, Any]:
        """Runs RAG retrieval, verifies grounding threshold, calls LLM, and formats citations."""
        if not question or not question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question string cannot be empty.",
            )

        search_results = self.search_similar_chunks(
            db, document, question, top_k=top_k, provider=embedding_provider
        )

        # Grounding Safeguard: Reject questions with poor semantic similarity
        if not search_results or search_results[0]["score"] > MAX_COSINE_DISTANCE_THRESHOLD:
            return {
                "answer": "I couldn't find enough information in this document to answer that question.",
                "sources": [],
            }

        # Format retrieved chunks for LLM Context Prompt & filter relevant sources
        context_parts: list[str] = []
        sources: list[dict[str, Any]] = []
        seen_pages: set[int] = set()

        top_score = search_results[0]["score"]

        for idx, res in enumerate(search_results, start=1):
            page_num = res["page_number"]
            content_snippet = res["content"].strip()
            context_parts.append(f"[Source {idx} — Page {page_num}]\n{content_snippet}")

            # Include in displayed sources if score is within relevant threshold and page is unique
            if page_num not in seen_pages and res["score"] <= min(0.78, top_score + 0.22):
                seen_pages.add(page_num)
                # Take a cleaner 250-character preview excerpt
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

        active_llm = llm_provider or get_llm_provider()
        raw_answer = active_llm.generate_text(RAG_SYSTEM_PROMPT, user_prompt)

        clean_answer = raw_answer.strip()
        if clean_answer.startswith("{") and "answer" in clean_answer:
            try:
                parsed = json.loads(clean_answer)
                if isinstance(parsed, dict) and "answer" in parsed:
                    clean_answer = str(parsed["answer"])
            except Exception:
                pass

        return {
            "answer": clean_answer,
            "sources": sources,
        }



rag_service = RAGService()
