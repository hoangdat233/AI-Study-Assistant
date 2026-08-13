from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, IndexResponse, MessageItem
from app.schemas.document import DocumentDetailResponse, DocumentResponse
from app.schemas.flashcard import FlashcardCreateRequest, FlashcardResponse
from app.schemas.progress import (
    DashboardResponse,
    DashboardStats,
    QuestionAttemptResult,
    QuizAttemptCreateRequest,
    QuizAttemptResponse,
    RecentActivityItem,
)
from app.schemas.quiz import QuestionResponse, QuizCreateRequest, QuizResponse
from app.schemas.summary import SummaryResponse

__all__ = [
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "UserResponse",
    "DocumentResponse",
    "DocumentDetailResponse",
    "SummaryResponse",
    "ChatMessageRequest",
    "ChatMessageResponse",
    "IndexResponse",
    "MessageItem",
    "QuizCreateRequest",
    "QuizResponse",
    "QuestionResponse",
    "FlashcardCreateRequest",
    "FlashcardResponse",
    "QuizAttemptCreateRequest",
    "QuizAttemptResponse",
    "QuestionAttemptResult",
    "DashboardStats",
    "RecentActivityItem",
    "DashboardResponse",
]






