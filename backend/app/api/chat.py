from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/history")
def get_chat_history() -> dict[str, list]:
    return {"items": []}
