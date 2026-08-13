from fastapi import APIRouter, status

from app.core.security import create_access_token
from app.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(_: RegisterRequest) -> dict[str, str]:
    return {"message": "Registration endpoint scaffolded."}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(payload.email))
