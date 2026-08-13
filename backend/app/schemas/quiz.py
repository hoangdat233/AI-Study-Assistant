import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, Field


class QuizQuestionGenerated(BaseModel):
    question: str = Field(description="The multiple-choice question text")
    options: list[str] = Field(
        min_items=4, max_items=4, description="List of 4 multiple-choice options (A, B, C, D)"
    )
    correct_answer: str = Field(description="The exact text of the correct choice from options")
    explanation: str = Field(description="Explanation of why this answer is correct based on document text")
    source_page: int | None = Field(default=None, description="Page number in document where answer is derived")


class QuizGenerationSchema(BaseModel):
    title: str = Field(description="Title of the generated quiz")
    questions: list[QuizQuestionGenerated] = Field(description="List of generated quiz questions")


class QuizCreateRequest(BaseModel):
    question_count: int = Field(default=5, ge=1, le=10, description="Number of questions to generate (1 to 10)")
    difficulty: Literal["easy", "medium", "hard"] = Field(
        default="medium", description="Difficulty level of questions"
    )


class QuestionResponse(BaseModel):
    id: uuid.UUID
    prompt: str
    options: list[str] | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    source_page: int | None = None
    order_index: int

    class Config:
        from_attributes = True


class QuizResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    title: str
    difficulty: str
    questions: list[QuestionResponse]
    created_at: datetime.datetime

    class Config:
        from_attributes = True
