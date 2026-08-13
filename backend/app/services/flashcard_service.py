import json
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.base import BaseLLMProvider
from app.ai.prompts import FLASHCARD_GENERATION_SYSTEM_PROMPT, build_flashcard_user_prompt
from app.ai.provider import get_llm_provider
from app.models.document import Document, DocumentChunk
from app.models.flashcard import Flashcard
from app.models.user import User
from app.schemas.flashcard import FlashcardGenerationSchema, FlashcardResponse


class FlashcardService:
    """Service managing AI flashcard generation, schema validation, and persistence."""

    def _sample_document_chunks(self, db: Session, document: Document, max_chars: int = 12_000) -> str:
        """Samples document text or vector chunks evenly across document pages."""
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document.id)
            .order_by(DocumentChunk.chunk_index.asc())
            .all()
        )

        if not chunks:
            text = (document.extracted_text or "").strip()
            if len(text) > max_chars:
                return text[:max_chars]
            return text

        total_chunks = len(chunks)
        if total_chunks <= 8:
            selected_chunks = chunks
        else:
            step = total_chunks / 8.0
            selected_indices = [int(i * step) for i in range(8)]
            selected_chunks = [chunks[i] for i in selected_indices if i < total_chunks]

        excerpt_parts: list[str] = []
        for c in selected_chunks:
            page_str = f" [Page {c.page_number}]" if c.page_number else ""
            excerpt_parts.append(f"--- Chunk{page_str} ---\n{c.content.strip()}")

        combined = "\n\n".join(excerpt_parts)
        if len(combined) > max_chars:
            return combined[:max_chars]
        return combined

    def _strip_markdown_code_blocks(self, text: str) -> str:
        cleaned = text.strip()
        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            return cleaned[start_idx : end_idx + 1]
        return cleaned

    def _parse_and_validate_flashcards(self, raw_llm_output: str) -> FlashcardGenerationSchema:
        cleaned_json = self._strip_markdown_code_blocks(raw_llm_output)
        try:
            parsed_dict = json.loads(cleaned_json)
            if not isinstance(parsed_dict, dict):
                raise ValueError("Expected JSON object")

            if "flashcards" not in parsed_dict and "cards" in parsed_dict:
                parsed_dict["flashcards"] = parsed_dict["cards"]

            return FlashcardGenerationSchema.model_validate(parsed_dict)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to parse structured JSON flashcards output from AI model: {str(exc)}",
            )

    def generate_flashcards(
        self,
        db: Session,
        user: User,
        document: Document,
        card_count: int = 10,
        provider: BaseLLMProvider | None = None,
    ) -> list[FlashcardResponse]:
        if card_count < 1 or card_count > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="card_count must be between 1 and 20.",
            )

        if not document.extracted_text or document.processing_status == "NO_TEXT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate flashcards. No extractable text found in this document.",
            )

        context_str = self._sample_document_chunks(db, document)
        user_prompt = build_flashcard_user_prompt(context_str, card_count)

        active_provider = provider or get_llm_provider()
        raw_output = active_provider.generate_text(
            FLASHCARD_GENERATION_SYSTEM_PROMPT, user_prompt, response_mime_type="application/json"
        )

        cards_schema = self._parse_and_validate_flashcards(raw_output)

        saved_cards: list[Flashcard] = []
        for card in cards_schema.flashcards[:card_count]:
            flashcard_rec = Flashcard(
                user_id=user.id,
                document_id=document.id,
                front=card.front,
                back=card.back,
                source_page=card.source_page,
            )
            db.add(flashcard_rec)
            saved_cards.append(flashcard_rec)

        db.commit()

        for c in saved_cards:
            db.refresh(c)

        return [FlashcardResponse.model_validate(c) for c in saved_cards]

    def list_document_flashcards(
        self, db: Session, user_id: uuid.UUID, document_id: uuid.UUID
    ) -> list[FlashcardResponse]:
        cards = (
            db.query(Flashcard)
            .filter(Flashcard.user_id == user_id, Flashcard.document_id == document_id)
            .order_by(Flashcard.created_at.asc())
            .all()
        )
        return [FlashcardResponse.model_validate(c) for c in cards]

    def delete_flashcard(self, db: Session, user_id: uuid.UUID, flashcard_id: uuid.UUID) -> bool:
        card = (
            db.query(Flashcard)
            .filter(Flashcard.id == flashcard_id, Flashcard.user_id == user_id)
            .first()
        )
        if not card:
            return False
        db.delete(card)
        db.commit()
        return True


flashcard_service = FlashcardService()
