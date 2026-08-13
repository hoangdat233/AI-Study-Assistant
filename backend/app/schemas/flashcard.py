from pydantic import BaseModel


class FlashcardResponse(BaseModel):
    id: str
    front: str
    back: str
