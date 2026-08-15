from abc import ABC, abstractmethod
import logging
import time
from typing import Any

from fastapi import HTTPException, status
import httpx

from app.core.config import settings

logger = logging.getLogger("ai_study_assistant")

EMBEDDING_DIMENSION = 3072


class BaseEmbeddingProvider(ABC):
    """Abstract interface for text embedding providers (3072 dimensions)."""

    @abstractmethod
    def embed_text(self, text: str) -> list[float]:
        """Embeds a single string into a 3072-dimensional vector."""
        pass

    @abstractmethod
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embeds multiple strings into a list of 3072-dimensional vectors."""
        pass


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Google Gemini text embedding provider using persistent client and retries."""

    def __init__(self, api_key: str | None = None, model: str = "gemini-embedding-001") -> None:
        self.api_key = api_key or settings.llm_api_key
        self.model = model

    def _check_api_key(self) -> None:
        if (
            not self.api_key
            or "YOUR_GEMINI_API_KEY" in self.api_key
            or "your_gemini_api_key_here" in self.api_key
        ):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Embedding service unavailable. Please configure LLM_API_KEY in your .env file.",
            )

    def embed_text(self, text: str) -> list[float]:
        self._check_api_key()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:embedContent?key={self.api_key}"
        payload: dict[str, Any] = {
            "content": {"parts": [{"text": text[:10_000]}]}  # Safeguard chunk length
        }

        last_err = None
        for attempt in range(1, 4):
            try:
                with httpx.Client(timeout=35.0) as client:
                    response = client.post(url, json=payload)
                    response.raise_for_status()
                    data = response.json()

                embedding_values = data.get("embedding", {}).get("values", [])
                if not embedding_values or len(embedding_values) != EMBEDDING_DIMENSION:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Embedding provider returned invalid vector size. Expected {EMBEDDING_DIMENSION}.",
                    )
                return embedding_values

            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                if status_code in (401, 403):
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Embedding service authentication failed. Invalid API key.",
                    )
                elif status_code == 429:
                    time.sleep(1.5 * attempt)
                    last_err = exc
                else:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Embedding provider request failed.",
                    )
            except httpx.RequestError as exc:
                logger.warning("Embedding request attempt %d failed: %s", attempt, exc)
                time.sleep(1.0 * attempt)
                last_err = exc

        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Embedding provider network request timed out after retries: {last_err}",
        )

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        embeddings: list[list[float]] = []
        for t in texts:
            embeddings.append(self.embed_text(t))
            time.sleep(0.1)  # Gentle pacing to avoid bursting API quotas
        return embeddings


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """Mock embedding provider returning deterministic 3072-dimensional vectors for testing."""

    def embed_text(self, text: str) -> list[float]:
        val = (abs(hash(text)) % 1000) / 1000.0
        vec = [val] * EMBEDDING_DIMENSION
        for i in range(min(10, EMBEDDING_DIMENSION)):
            vec[i] = (val + i * 0.01) % 1.0
        return vec

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_text(t) for t in texts]


def get_embedding_provider() -> BaseEmbeddingProvider:
    provider_type = (settings.llm_provider or "gemini").lower()
    if provider_type == "mock":
        return MockEmbeddingProvider()
    return GeminiEmbeddingProvider()
