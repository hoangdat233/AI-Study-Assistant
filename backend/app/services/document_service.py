import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
import pypdf
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.user import User

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
STORAGE_BASE_DIR = Path(__file__).resolve().parents[2] / "storage" / "documents"


class DocumentService:
    """Service handling PDF validation, storage, pypdf extraction, and DB operations."""

    def __init__(self, storage_dir: Path = STORAGE_BASE_DIR) -> None:
        self.storage_dir = storage_dir

    def validate_pdf(self, file_bytes: bytes, filename: str) -> None:
        # 1. Enforce file size limit
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
            )

        # 2. Inspect magic bytes (%PDF-)
        if not file_bytes.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file format. Only valid PDF files are allowed.",
            )

    def extract_pdf_content(self, file_bytes: bytes) -> tuple[str | None, int | None, str]:
        """Extracts text page by page using pypdf.

        Returns (extracted_text, page_count, processing_status).
        """
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            page_count = len(reader.pages)
            extracted_pages: list[str] = []

            for index, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                cleaned = text.strip()
                if cleaned:
                    extracted_pages.append(f"--- Page {index + 1} ---\n{cleaned}")

            full_text = "\n\n".join(extracted_pages).strip()

            if not full_text:
                return (
                    "No extractable text found in this PDF (scanned or image-only PDF).",
                    page_count,
                    "NO_TEXT_FOUND",
                )

            return (full_text, page_count, "COMPLETED")
        except pypdf.errors.PdfReadError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to parse PDF file. The file may be corrupt.",
            )

    def save_file_to_disk(
        self, user_id: uuid.UUID, doc_id: uuid.UUID, file_bytes: bytes
    ) -> Path:
        user_dir = self.storage_dir / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        file_path = (user_dir / f"{doc_id}.pdf").resolve()

        # Path traversal guard: Ensure target path remains inside storage_dir
        if not str(file_path).startswith(str(self.storage_dir.resolve())):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path detected.",
            )

        file_path.write_bytes(file_bytes)
        return file_path

    def create_document(
        self, db: Session, user: User, file: UploadFile, file_bytes: bytes
    ) -> Document:
        original_filename = file.filename or "document.pdf"
        self.validate_pdf(file_bytes, original_filename)

        doc_id = uuid.uuid4()
        file_path = self.save_file_to_disk(user.id, doc_id, file_bytes)

        extracted_text, page_count, status_str = self.extract_pdf_content(file_bytes)

        title = Path(original_filename).stem[:255] or "Untitled Document"

        document = Document(
            id=doc_id,
            user_id=user.id,
            title=title,
            original_filename=original_filename,
            file_path=str(file_path),
            file_size=len(file_bytes),
            page_count=page_count,
            extracted_text=extracted_text,
            processing_status=status_str,
        )

        db.add(document)
        db.commit()
        db.refresh(document)
        return document

    def list_user_documents(self, db: Session, user_id: uuid.UUID) -> list[Document]:
        stmt = (
            select(Document)
            .where(Document.user_id == user_id)
            .order_by(Document.created_at.desc())
        )
        return list(db.scalars(stmt).all())

    def get_user_document_by_id(
        self, db: Session, user_id: uuid.UUID, document_id: uuid.UUID
    ) -> Document | None:
        stmt = select(Document).where(
            Document.id == document_id, Document.user_id == user_id
        )
        return db.scalar(stmt)

    def delete_user_document(
        self, db: Session, user_id: uuid.UUID, document_id: uuid.UUID
    ) -> bool:
        document = self.get_user_document_by_id(db, user_id, document_id)
        if not document:
            return False

        # Delete physical file safely
        disk_path = Path(document.file_path)
        if disk_path.exists():
            disk_path.unlink(missing_ok=True)

        db.delete(document)
        db.commit()
        return True


document_service = DocumentService()

