import datetime
import uuid

from pydantic import BaseModel, Field


class FlashcardGenerated(BaseModel):
    front: str = Field(description="Front side of flashcard (term, question, or formula)")
    back: str = Field(description="Back side of flashcard (definition, answer, or explanation)")
    source_page: int | None = Field(default=None, description="Page number where concept is referenced")


class FlashcardGenerationSchema(BaseModel):
    flashcards: list[FlashcardGenerated] = Field(description="List of generated flashcards")


class FlashcardCreateRequest(BaseModel):
    card_count: int = Field(default=10, ge=1, le=20, description="Number of flashcards to generate (1 to 20)")


class FlashcardResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    front: str
    back: str
    source_page: int | None = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True
