from fastapi import APIRouter

from app.api import auth, chat, dashboard, documents, flashcards, health, progress, quizzes

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(documents.router)
api_router.include_router(chat.router)
api_router.include_router(quizzes.router)
api_router.include_router(flashcards.router)
api_router.include_router(progress.router)
api_router.include_router(dashboard.router)
