from fastapi import APIRouter

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("")
def get_progress() -> dict[str, list]:
    return {"items": []}
