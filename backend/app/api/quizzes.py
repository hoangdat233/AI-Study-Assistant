from fastapi import APIRouter

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.get("")
def list_quizzes() -> dict[str, list]:
    return {"items": []}
