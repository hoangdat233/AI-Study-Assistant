from app.db.base import Base
from app.db.session import engine
from app.models import (  # noqa: F401
    Chat,
    Document,
    DocumentChunk,
    Flashcard,
    Message,
    Question,
    Quiz,
    StudyProgress,
    User,
)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
