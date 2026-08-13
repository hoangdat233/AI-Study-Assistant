import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.progress import QuizAttemptCreateRequest, QuizAttemptResponse
from app.schemas.quiz import QuizCreateRequest, QuizResponse
from app.services.dashboard_service import dashboard_service
from app.services.document_service import document_service
from app.services.quiz_service import quiz_service

router = APIRouter(tags=["quizzes"])


@router.post("/documents/{document_id}/quizzes", status_code=status.HTTP_201_CREATED, response_model=QuizResponse)
def generate_quiz_endpoint(
    document_id: uuid.UUID,
    body: QuizCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> QuizResponse:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return quiz_service.generate_quiz(
        db, current_user, doc, question_count=body.question_count, difficulty=body.difficulty
    )


@router.get("/documents/{document_id}/quizzes", response_model=list[QuizResponse])
def list_document_quizzes_endpoint(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[QuizResponse]:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    quizzes = quiz_service.list_document_quizzes(db, current_user.id, doc.id)
    return [QuizResponse.model_validate(q) for q in quizzes]


@router.get("/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz_endpoint(
    quiz_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> QuizResponse:
    quiz = quiz_service.get_quiz_by_id(db, current_user.id, quiz_id)
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )
    return QuizResponse.model_validate(quiz)


@router.post("/quizzes/{quiz_id}/attempts", status_code=status.HTTP_201_CREATED, response_model=QuizAttemptResponse)
def submit_quiz_attempt_endpoint(
    quiz_id: uuid.UUID,
    body: QuizAttemptCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> QuizAttemptResponse:
    quiz = quiz_service.get_quiz_by_id(db, current_user.id, quiz_id)
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )

    return dashboard_service.submit_quiz_attempt(db, current_user, quiz, body.answers)


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz_endpoint(
    quiz_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    success = quiz_service.delete_quiz(db, current_user.id, quiz_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
