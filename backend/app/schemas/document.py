from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    original_filename: str
    file_size: int
    page_count: int | None = None
    processing_status: str
    created_at: datetime
    updated_at: datetime


class DocumentDetailResponse(DocumentResponse):
    extracted_text: str | None = None
    content_summary: str | None = None

