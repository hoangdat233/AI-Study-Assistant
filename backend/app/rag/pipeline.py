from dataclasses import dataclass


@dataclass(slots=True)
class RetrievedChunk:
    content: str
    source: str


class RAGPipeline:
    """Future RAG pipeline orchestration entry point."""

    def run(self, question: str) -> str:
        raise NotImplementedError("RAG pipeline is planned but not yet implemented.")
