import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.document import DocumentResponse


class QuizAttemptCreateRequest(BaseModel):
    answers: dict[uuid.UUID, str] = Field(
        description="Dictionary mapping question_id UUIDs to student's selected option text string"
    )


class QuestionAttemptResult(BaseModel):
    question_id: uuid.UUID
    prompt: str
    selected_option: str | None = None
    correct_answer: str
    is_correct: bool
    explanation: str | None = None
    source_page: int | None = None


class QuizAttemptResponse(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    score: int
    total_questions: int
    percentage: float
    details: list[QuestionAttemptResult] = Field(default_factory=list)
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    documents: int = Field(default=0, description="Total PDF documents uploaded")
    questions_asked: int = Field(default=0, description="Total AI RAG questions asked")
    quizzes_completed: int = Field(default=0, description="Total completed quiz attempts")
    average_quiz_score: float = Field(default=0.0, description="Average percentage score across quiz attempts")
    flashcards: int = Field(default=0, description="Total flashcards generated")


class RecentActivityItem(BaseModel):
    id: str
    type: Literal["upload", "chat", "quiz_gen", "quiz_attempt", "flashcard"]
    title: str
    description: str
    timestamp: datetime.datetime


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_documents: list[DocumentResponse] = Field(default_factory=list)
    recent_activity: list[RecentActivityItem] = Field(default_factory=list)
