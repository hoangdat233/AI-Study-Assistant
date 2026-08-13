import json
import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.base import BaseLLMProvider
from app.ai.prompts import (
    MAP_REDUCE_COMBINE_SYSTEM_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    build_user_summary_prompt,
)
from app.ai.provider import get_llm_provider
from app.models.document import Document
from app.schemas.summary import SummaryResponse

CHUNK_CHARACTER_THRESHOLD = 12_000
TARGET_CHUNK_SIZE = 10_000


class SummaryService:
    """Service managing AI summary generation, long-document map-reduce chunking, and persistence."""

    def _strip_markdown_code_blocks(self, text: str) -> str:
        cleaned = text.strip()
        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            return cleaned[start_idx : end_idx + 1]
        return cleaned

    def _parse_and_validate_summary(self, raw_llm_output: str) -> SummaryResponse:
        cleaned_json_str = self._strip_markdown_code_blocks(raw_llm_output)
        try:
            parsed_data = json.loads(cleaned_json_str)
            if not isinstance(parsed_data, dict):
                raise ValueError("Expected JSON object from AI model")

            overview = (
                parsed_data.get("overview")
                or parsed_data.get("summary")
                or parsed_data.get("overview_text")
                or "Document summary overview."
            )

            key_points = (
                parsed_data.get("key_points")
                or parsed_data.get("keyPoints")
                or parsed_data.get("takeaways")
                or parsed_data.get("points")
                or []
            )
            if isinstance(key_points, str):
                key_points = [p.strip("- *") for p in key_points.split("\n") if p.strip()]

            important_terms = (
                parsed_data.get("important_terms")
                or parsed_data.get("importantTerms")
                or parsed_data.get("terms")
                or []
            )
            if isinstance(important_terms, str):
                important_terms = [t.strip("- *") for t in important_terms.split("\n") if t.strip()]

            conclusion = (
                parsed_data.get("conclusion")
                or parsed_data.get("summary_conclusion")
                or ""
            )

            return SummaryResponse(
                overview=str(overview),
                key_points=[str(kp) for kp in key_points] if key_points else ["Key takeaway points."],
                important_terms=[str(it) for it in important_terms],
                conclusion=str(conclusion),
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to parse valid structured JSON summary from AI response.",
            )


    def _chunk_text(self, text: str, max_chunk_size: int = TARGET_CHUNK_SIZE) -> list[str]:
        """Splits long text into manageable chunks at paragraph boundaries."""
        paragraphs = text.split("\n\n")
        chunks: list[str] = []
        current_chunk: list[str] = []
        current_length = 0

        for para in paragraphs:
            para_len = len(para)
            if current_length + para_len > max_chunk_size and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [para]
                current_length = para_len
            else:
                current_chunk.append(para)
                current_length += para_len + 2

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        return chunks

    def get_existing_summary(self, document: Document) -> SummaryResponse | None:
        if not document.content_summary:
            return None
        try:
            parsed = json.loads(document.content_summary)
            return SummaryResponse.model_validate(parsed)
        except Exception:
            return None

    def generate_summary(
        self,
        db: Session,
        document: Document,
        provider: BaseLLMProvider | None = None,
        force_regenerate: bool = False,
    ) -> SummaryResponse:
        # 1. Cost & UX Optimization: Reuse existing summary if available and not forced
        if not force_regenerate and document.content_summary:
            existing = self.get_existing_summary(document)
            if existing:
                return existing

        # 2. Check document text eligibility
        if not document.extracted_text or document.processing_status == "NO_TEXT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate AI summary. No extractable text found in this PDF (e.g. scanned or image-only PDF).",
            )

        active_provider = provider or get_llm_provider()
        text = document.extracted_text.strip()

        # 3. Process text (Direct vs Map-Reduce)
        if len(text) <= CHUNK_CHARACTER_THRESHOLD:
            user_prompt = build_user_summary_prompt(text)
            raw_output = active_provider.generate_text(
                SUMMARY_SYSTEM_PROMPT, user_prompt, response_mime_type="application/json"
            )
            summary_obj = self._parse_and_validate_summary(raw_output)
        else:
            # Map Stage: Summarize individual text chunks
            chunks = self._chunk_text(text)
            intermediate_summaries: list[str] = []
            for chunk in chunks:
                user_prompt = build_user_summary_prompt(chunk)
                chunk_output = active_provider.generate_text(
                    SUMMARY_SYSTEM_PROMPT, user_prompt, response_mime_type="application/json"
                )
                intermediate_summaries.append(chunk_output)

            # Reduce Stage: Combine chunk summaries into final structured summary
            combined_text = "\n\n".join(intermediate_summaries)
            user_prompt = f"Please combine and synthesize these section summaries into one final structured summary:\n\n{combined_text}"
            final_raw_output = active_provider.generate_text(
                MAP_REDUCE_COMBINE_SYSTEM_PROMPT, user_prompt, response_mime_type="application/json"
            )
            summary_obj = self._parse_and_validate_summary(final_raw_output)


        # 4. Save summary to database
        summary_json_str = summary_obj.model_dump_json()
        document.content_summary = summary_json_str
        db.commit()
        db.refresh(document)

        return summary_obj


summary_service = SummaryService()
