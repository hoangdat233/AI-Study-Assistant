import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.flashcard import FlashcardCreateRequest, FlashcardResponse
from app.services.document_service import document_service
from app.services.flashcard_service import flashcard_service

router = APIRouter(tags=["flashcards"])


@router.post("/documents/{document_id}/flashcards", status_code=status.HTTP_201_CREATED, response_model=list[FlashcardResponse])
def generate_flashcards_endpoint(
    document_id: uuid.UUID,
    body: FlashcardCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[FlashcardResponse]:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return flashcard_service.generate_flashcards(
        db, current_user, doc, card_count=body.card_count
    )


@router.get("/documents/{document_id}/flashcards", response_model=list[FlashcardResponse])
def list_document_flashcards_endpoint(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[FlashcardResponse]:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return flashcard_service.list_document_flashcards(db, current_user.id, doc.id)


@router.delete("/flashcards/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flashcard_endpoint(
    flashcard_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    success = flashcard_service.delete_flashcard(db, current_user.id, flashcard_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
