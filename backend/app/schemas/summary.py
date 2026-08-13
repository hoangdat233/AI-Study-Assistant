from pydantic import BaseModel, ConfigDict, Field


class SummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    overview: str = Field(description="High-level executive summary of the document")
    key_points: list[str] = Field(description="Bulleted list of main takeaways and concepts")
    important_terms: list[str] = Field(
        default_factory=list, description="Key terminology and definitions"
    )
    conclusion: str = Field(default="", description="Concluding synthesis statement")
