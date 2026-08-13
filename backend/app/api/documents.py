import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
import json
from app.models.chat import Chat, Message
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, IndexResponse, MessageItem
from app.schemas.document import DocumentDetailResponse, DocumentResponse
from app.schemas.summary import SummaryResponse
from app.services.document_service import document_service
from app.services.indexing_service import indexing_service
from app.services.rag_service import rag_service
from app.services.summary_service import summary_service

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


@router.get("/{document_id}/summary", response_model=SummaryResponse)
def get_document_summary(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SummaryResponse:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    summary = summary_service.get_existing_summary(doc)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No summary has been generated for this document yet.",
        )
    return summary


@router.post("/{document_id}/summary", response_model=SummaryResponse)
def generate_document_summary(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    force: bool = False,
) -> SummaryResponse:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return summary_service.generate_summary(db, doc, force_regenerate=force)


@router.post("/{document_id}/index", response_model=IndexResponse)
def index_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    force: bool = False,
) -> IndexResponse:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    chunk_count = indexing_service.index_document(db, doc, force=force)
    return IndexResponse(indexed=True, chunk_count=chunk_count, processing_status="INDEXED")


@router.post("/{document_id}/search")
def search_document(
    document_id: uuid.UUID,
    body: ChatMessageRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, list]:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    results = rag_service.search_similar_chunks(db, doc, body.question)
    return {"results": results}


@router.post("/{document_id}/chat", response_model=ChatMessageResponse)
def chat_with_document(
    document_id: uuid.UUID,
    body: ChatMessageRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatMessageResponse:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # Find or create chat conversation record
    chat = db.query(Chat).filter(Chat.user_id == current_user.id, Chat.document_id == doc.id).first()
    if not chat:
        chat = Chat(user_id=current_user.id, document_id=doc.id, title=doc.title)
        db.add(chat)
        db.commit()
        db.refresh(chat)

    # Save User message
    user_msg = Message(chat_id=chat.id, role="user", content=body.question.strip())
    db.add(user_msg)
    db.commit()

    # Generate RAG answer & sources
    rag_res = rag_service.answer_question(db, doc, body.question.strip())

    # Save Assistant message
    assistant_msg = Message(
        chat_id=chat.id,
        role="assistant",
        content=rag_res["answer"],
        source_reference=json.dumps(rag_res["sources"]),
    )
    db.add(assistant_msg)
    db.commit()

    return ChatMessageResponse(
        answer=rag_res["answer"],
        sources=rag_res["sources"],
        chat_id=chat.id,
    )


@router.get("/{document_id}/chat", response_model=list[MessageItem])
def get_document_chat_history(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[MessageItem]:
    doc = document_service.get_user_document_by_id(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    chat = db.query(Chat).filter(Chat.user_id == current_user.id, Chat.document_id == doc.id).first()
    if not chat:
        return []

    messages = (
        db.query(Message)
        .filter(Message.chat_id == chat.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    result_items: list[MessageItem] = []
    for m in messages:
        parsed_sources: list[dict] = []
        if m.source_reference:
            try:
                parsed_sources = json.loads(m.source_reference)
            except Exception:
                parsed_sources = []
        result_items.append(
            MessageItem(
                id=m.id,
                role=m.role,
                content=m.content,
                sources=parsed_sources,
                created_at=m.created_at,
            )
        )

    return result_items



