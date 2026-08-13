from pydantic import BaseModel


class QuizResponse(BaseModel):
    id: str
    title: str
