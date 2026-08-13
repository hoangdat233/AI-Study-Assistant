from fastapi import APIRouter

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents() -> dict[str, list]:
    return {"items": []}
