import json
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.base import BaseLLMProvider
from app.ai.prompts import QUIZ_GENERATION_SYSTEM_PROMPT, build_quiz_user_prompt
from app.ai.provider import get_llm_provider
from app.models.document import Document, DocumentChunk
from app.models.quiz import Question, Quiz
from app.models.user import User
from app.schemas.quiz import QuizGenerationSchema, QuizResponse


class QuizService:
    """Service managing AI quiz generation, chunk sampling across pages, and DB persistence."""

    def _sample_document_chunks(self, db: Session, document: Document, max_chars: int = 12_000) -> str:
        """Samples document text or vector chunks evenly across document pages for broad coverage."""
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

        # Sample chunks evenly across pages
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

    def _parse_and_validate_quiz(self, raw_llm_output: str) -> QuizGenerationSchema:
        cleaned_json = self._strip_markdown_code_blocks(raw_llm_output)
        try:
            parsed_dict = json.loads(cleaned_json)
            if not isinstance(parsed_dict, dict):
                raise ValueError("Expected JSON object")

            # Fallback keys normalization
            if "questions" not in parsed_dict and "quiz" in parsed_dict:
                if isinstance(parsed_dict["quiz"], list):
                    parsed_dict["questions"] = parsed_dict["quiz"]

            return QuizGenerationSchema.model_validate(parsed_dict)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to parse structured JSON quiz output from AI model: {str(exc)}",
            )

    def generate_quiz(
        self,
        db: Session,
        user: User,
        document: Document,
        question_count: int = 5,
        difficulty: str = "medium",
        provider: BaseLLMProvider | None = None,
    ) -> QuizResponse:
        # Enforce limits
        if question_count < 1 or question_count > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="question_count must be between 1 and 10.",
            )

        if not document.extracted_text or document.processing_status == "NO_TEXT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate quiz. No extractable text found in this document.",
            )

        context_str = self._sample_document_chunks(db, document)
        user_prompt = build_quiz_user_prompt(context_str, question_count, difficulty)

        active_provider = provider or get_llm_provider()
        raw_output = active_provider.generate_text(
            QUIZ_GENERATION_SYSTEM_PROMPT, user_prompt, response_mime_type="application/json"
        )

        quiz_schema = self._parse_and_validate_quiz(raw_output)

        # Save to database
        quiz = Quiz(
            user_id=user.id,
            document_id=document.id,
            title=quiz_schema.title or f"{document.title} Quiz",
            difficulty=difficulty,
        )
        db.add(quiz)
        db.commit()
        db.refresh(quiz)

        for idx, q in enumerate(quiz_schema.questions[:question_count], start=1):
            question_rec = Question(
                quiz_id=quiz.id,
                prompt=q.question,
                answer=q.correct_answer,
                options=q.options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                source_page=q.source_page,
                order_index=idx,
            )
            db.add(question_rec)

        db.commit()
        db.refresh(quiz)

        return QuizResponse.model_validate(quiz)

    def list_document_quizzes(self, db: Session, user_id: uuid.UUID, document_id: uuid.UUID) -> list[Quiz]:
        return (
            db.query(Quiz)
            .filter(Quiz.user_id == user_id, Quiz.document_id == document_id)
            .order_by(Quiz.created_at.desc())
            .all()
        )

    def get_quiz_by_id(self, db: Session, user_id: uuid.UUID, quiz_id: uuid.UUID) -> Quiz | None:
        return db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user_id).first()

    def delete_quiz(self, db: Session, user_id: uuid.UUID, quiz_id: uuid.UUID) -> bool:
        quiz = self.get_quiz_by_id(db, user_id, quiz_id)
        if not quiz:
            return False
        db.delete(quiz)
        db.commit()
        return True


quiz_service = QuizService()
