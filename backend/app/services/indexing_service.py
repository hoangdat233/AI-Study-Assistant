from dataclasses import dataclass
import re

from fastapi import HTTPException, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.ai.embedding import BaseEmbeddingProvider, get_embedding_provider
from app.models.document import Document, DocumentChunk

TARGET_WORDS_PER_CHUNK = 400
OVERLAP_WORDS = 80


@dataclass(slots=True)
class ParsedChunk:
    chunk_index: int
    page_number: int | None
    content: str


class DocumentChunker:
    """Custom page-aware document chunker with word overlap."""

    def chunk_document(
        self,
        extracted_text: str,
        target_words: int = TARGET_WORDS_PER_CHUNK,
        overlap_words: int = OVERLAP_WORDS,
    ) -> list[ParsedChunk]:
        if not extracted_text or not extracted_text.strip():
            return []

        # Split document by page headers ("--- Page N ---")
        page_blocks = re.split(r"(^|\n)--- Page (\d+) ---\n", extracted_text)
        
        parsed_pages: list[tuple[int, str]] = []
        
        # If no page headers found, treat entire text as Page 1
        if len(page_blocks) == 1:
            parsed_pages.append((1, extracted_text.strip()))
        else:
            idx = 1
            while idx < len(page_blocks):
                # page_blocks format from re.split: [preamble, match_prefix, page_num_str, page_text, ...]
                if page_blocks[idx + 1].isdigit():
                    p_num = int(page_blocks[idx + 1])
                    p_text = page_blocks[idx + 2].strip() if idx + 2 < len(page_blocks) else ""
                    if p_text:
                        parsed_pages.append((p_num, p_text))
                    idx += 3
                else:
                    idx += 1

        chunks: list[ParsedChunk] = []
        global_chunk_index = 0

        for page_num, page_text in parsed_pages:
            words = page_text.split()
            if not words:
                continue

            # If page text is within target_words limit, create a single chunk
            if len(words) <= target_words:
                chunks.append(
                    ParsedChunk(
                        chunk_index=global_chunk_index,
                        page_number=page_num,
                        content=" ".join(words),
                    )
                )
                global_chunk_index += 1
                continue

            # Slice words into overlapping windows
            step = max(1, target_words - overlap_words)
            start = 0
            while start < len(words):
                end = min(start + target_words, len(words))
                chunk_words = words[start:end]
                if chunk_words:
                    chunks.append(
                        ParsedChunk(
                            chunk_index=global_chunk_index,
                            page_number=page_num,
                            content=" ".join(chunk_words),
                        )
                    )
                    global_chunk_index += 1

                if end == len(words):
                    break
                start += step

        return chunks


class IndexingService:
    """Service managing document chunking, embedding generation, and vector indexing."""

    def __init__(self, chunker: DocumentChunker | None = None) -> None:
        self.chunker = chunker or DocumentChunker()

    def index_document(
        self,
        db: Session,
        document: Document,
        provider: BaseEmbeddingProvider | None = None,
        force: bool = False,
    ) -> int:
        # 1. Cost Safeguard: Return existing chunk count if already indexed and not forced
        if not force and document.processing_status == "INDEXED" and document.chunks:
            return len(document.chunks)

        # 2. Check text eligibility
        if not document.extracted_text or document.processing_status == "NO_TEXT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot index document. No extractable text found in this PDF.",
            )

        active_provider = provider or get_embedding_provider()

        # 3. Chunk extracted text
        parsed_chunks = self.chunker.chunk_document(document.extracted_text)
        if not parsed_chunks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Extracted document text produced no valid content chunks.",
            )

        # 4. Generate embeddings in batch
        contents = [c.content for c in parsed_chunks]
        embeddings = active_provider.embed_texts(contents)

        # 5. Delete previous chunks if re-indexing
        stmt_delete = delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
        db.execute(stmt_delete)

        # 6. Store new chunks with embeddings in DB
        db_chunks: list[DocumentChunk] = []
        for parsed, vec in zip(parsed_chunks, embeddings):
            db_chunks.append(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=parsed.chunk_index,
                    page_number=parsed.page_number,
                    content=parsed.content,
                    embedding=vec,
                )
            )

        db.add_all(db_chunks)
        document.processing_status = "INDEXED"
        db.commit()
        db.refresh(document)

        return len(db_chunks)


indexing_service = IndexingService()
