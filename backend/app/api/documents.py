import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.document import DocumentDetailResponse, DocumentResponse
from app.services.document_service import document_service

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DocumentDetailResponse)
def upload_document(
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DocumentDetailResponse:
    file_bytes = file.file.read()
    doc = document_service.create_document(db, current_user, file, file_bytes)
    return DocumentDetailResponse.model_validate(doc)


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[DocumentResponse]:
    docs = document_service.list_user_documents(db, current_user.id)
    return [DocumentResponse.model_validate(d) for d in docs]


@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DocumentDetailResponse:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return DocumentDetailResponse.model_validate(doc)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    success = document_service.delete_user_document(db, current_user.id, document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

