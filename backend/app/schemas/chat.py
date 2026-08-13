from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageRequest(BaseModel):
    question: str = Field(min_length=1, description="Student's query string")


class SourceItem(BaseModel):
    page: int = Field(description="Document page number")
    chunk_id: str = Field(description="Database chunk UUID")
    preview: str = Field(description="Extracted text preview snippet")
    score: float = Field(default=0.0, description="Vector similarity distance score")


class ChatMessageResponse(BaseModel):
    answer: str = Field(description="Grounded AI response")
    sources: list[SourceItem] = Field(default_factory=list, description="Source page citations")
    chat_id: uuid.UUID = Field(description="Chat conversation UUID")


class MessageItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    sources: list[dict[str, Any]] = Field(default_factory=list)
    created_at: Any


class IndexResponse(BaseModel):
    indexed: bool = True
    chunk_count: int
    processing_status: str = "INDEXED"
