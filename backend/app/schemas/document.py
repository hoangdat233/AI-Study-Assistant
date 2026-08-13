from pydantic import BaseModel


class DocumentCreateRequest(BaseModel):
    title: str


class DocumentResponse(BaseModel):
    id: str
    title: str
