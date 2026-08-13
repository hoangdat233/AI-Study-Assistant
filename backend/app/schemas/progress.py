from pydantic import BaseModel


class StudyProgressResponse(BaseModel):
    id: str
    completion_percent: int
