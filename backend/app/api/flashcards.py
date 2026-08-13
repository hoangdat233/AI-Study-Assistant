from fastapi import APIRouter

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


@router.get("")
def list_flashcards() -> dict[str, list]:
    return {"items": []}
