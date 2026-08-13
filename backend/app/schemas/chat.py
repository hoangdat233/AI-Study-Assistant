from pydantic import BaseModel


class ChatMessageRequest(BaseModel):
    question: str


class ChatMessageResponse(BaseModel):
    answer: str
    sources: list[str]
