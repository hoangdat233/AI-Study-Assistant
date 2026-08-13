import uuid
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.chat import Chat, Message
from app.models.document import Document
from app.models.flashcard import Flashcard
from app.models.quiz import Question, Quiz, QuizAttempt
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.schemas.progress import (
    DashboardResponse,
    DashboardStats,
    QuestionAttemptResult,
    QuizAttemptResponse,
    RecentActivityItem,
)


class DashboardService:
    """Service handling server-side quiz grading, user activity aggregation, and dashboard statistics."""

    def submit_quiz_attempt(
        self, db: Session, user: User, quiz: Quiz, answers: dict[uuid.UUID, str]
    ) -> QuizAttemptResponse:
        questions = (
            db.query(Question)
            .filter(Question.quiz_id == quiz.id)
            .order_by(Question.order_index.asc())
            .all()
        )

        total_questions = len(questions)
        if total_questions == 0:
            total_questions = 1  # Guard against division by zero

        score = 0
        details: list[QuestionAttemptResult] = []

        for q in questions:
            selected_option = answers.get(q.id) or answers.get(str(q.id))
            correct_ans = q.correct_answer or q.answer
            is_correct = selected_option is not None and selected_option.strip() == correct_ans.strip()

            if is_correct:
                score += 1

            details.append(
                QuestionAttemptResult(
                    question_id=q.id,
                    prompt=q.prompt,
                    selected_option=selected_option,
                    correct_answer=correct_ans,
                    is_correct=is_correct,
                    explanation=q.explanation,
                    source_page=q.source_page,
                )
            )

        percentage = round((score / total_questions) * 100.0, 1)

        attempt = QuizAttempt(
            user_id=user.id,
            quiz_id=quiz.id,
            score=score,
            total_questions=total_questions,
            percentage=percentage,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)

        return QuizAttemptResponse(
            id=attempt.id,
            quiz_id=quiz.id,
            score=score,
            total_questions=total_questions,
            percentage=percentage,
            details=details,
            created_at=attempt.created_at,
        )

    def get_user_dashboard(self, db: Session, user_id: uuid.UUID) -> DashboardResponse:
        # 1. Aggregate Core Counts
        docs_count = db.query(Document).filter(Document.user_id == user_id).count()

        questions_asked_count = (
            db.query(Message)
            .join(Chat)
            .filter(Chat.user_id == user_id, Message.role == "user")
            .count()
        )

        quizzes_completed_count = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).count()

        avg_score_res = (
            db.query(func.avg(QuizAttempt.percentage))
            .filter(QuizAttempt.user_id == user_id)
            .scalar()
        )
        average_quiz_score = round(float(avg_score_res), 1) if avg_score_res is not None else 0.0

        flashcards_count = db.query(Flashcard).filter(Flashcard.user_id == user_id).count()

        stats = DashboardStats(
            documents=docs_count,
            questions_asked=questions_asked_count,
            quizzes_completed=quizzes_completed_count,
            average_quiz_score=average_quiz_score,
            flashcards=flashcards_count,
        )

        # 2. Fetch 5 Recent Documents
        recent_docs_records = (
            db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.created_at.desc())
            .limit(5)
            .all()
        )
        recent_documents = [DocumentResponse.model_validate(d) for d in recent_docs_records]

        # 3. Synthesize Recent Activity Timeline
        activity_items: list[RecentActivityItem] = []

        # Uploads
        for doc in recent_docs_records:
            activity_items.append(
                RecentActivityItem(
                    id=f"doc-{doc.id}",
                    type="upload",
                    title="Uploaded PDF Document",
                    description=f'Uploaded "{doc.original_filename}" ({doc.title})',
                    timestamp=doc.created_at,
                )
            )

        # Chat messages
        recent_messages = (
            db.query(Message)
            .join(Chat)
            .filter(Chat.user_id == user_id, Message.role == "user")
            .order_by(Message.created_at.desc())
            .limit(5)
            .all()
        )
        for msg in recent_messages:
            preview = msg.content[:60] + "..." if len(msg.content) > 60 else msg.content
            activity_items.append(
                RecentActivityItem(
                    id=f"msg-{msg.id}",
                    type="chat",
                    title="Asked AI Document Question",
                    description=f'"{preview}"',
                    timestamp=msg.created_at,
                )
            )

        # Quiz attempts
        recent_attempts = (
            db.query(QuizAttempt)
            .join(Quiz)
            .filter(QuizAttempt.user_id == user_id)
            .order_by(QuizAttempt.created_at.desc())
            .limit(5)
            .all()
        )
        for att in recent_attempts:
            activity_items.append(
                RecentActivityItem(
                    id=f"att-{att.id}",
                    type="quiz_attempt",
                    title="Completed Practice Quiz",
                    description=f"Scored {att.score}/{att.total_questions} ({att.percentage}%) on {att.quiz.title}",
                    timestamp=att.created_at,
                )
            )

        # Quiz creations
        recent_quizzes = (
            db.query(Quiz)
            .filter(Quiz.user_id == user_id)
            .order_by(Quiz.created_at.desc())
            .limit(5)
            .all()
        )
        for q in recent_quizzes:
            activity_items.append(
                RecentActivityItem(
                    id=f"qz-{q.id}",
                    type="quiz_gen",
                    title="Generated AI Practice Quiz",
                    description=f'Created "{q.title}" ({q.difficulty.upper()})',
                    timestamp=q.created_at,
                )
            )

        # Flashcards creations
        recent_flashcards = (
            db.query(Flashcard)
            .filter(Flashcard.user_id == user_id)
            .order_by(Flashcard.created_at.desc())
            .limit(5)
            .all()
        )
        if recent_flashcards:
            latest_fc = recent_flashcards[0]
            activity_items.append(
                RecentActivityItem(
                    id=f"fc-{latest_fc.id}",
                    type="flashcard",
                    title="Generated AI Flashcards",
                    description=f"Created study flashcards for document",
                    timestamp=latest_fc.created_at,
                )
            )

        # Sort timeline by timestamp desc and take top 10
        activity_items.sort(key=lambda x: x.timestamp, reverse=True)
        recent_activity = activity_items[:10]

        return DashboardResponse(
            stats=stats,
            recent_documents=recent_documents,
            recent_activity=recent_activity,
        )



dashboard_service = DashboardService()
