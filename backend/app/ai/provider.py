import json
from typing import Any

from fastapi import HTTPException, status
import httpx

from app.ai.base import BaseLLMProvider
from app.core.config import settings


class GeminiProvider(BaseLLMProvider):
    """Google Gemini LLM provider implementation using direct REST API calls."""

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model or "gemini-3.5-flash"


    def generate_text(self, system_prompt: str, user_prompt: str) -> str:
        if (
            not self.api_key
            or "YOUR_GEMINI_API_KEY" in self.api_key
            or "your_gemini_api_key_here" in self.api_key
        ):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service unavailable. Please set a valid LLM_API_KEY in your .env file.",
            )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}

        payload: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "response_mime_type": "application/json",
            },
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()

            candidates = data.get("candidates", [])
            if not candidates:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="AI service returned an empty completion response.",
                )

            text_content = (
                candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            )
            if not text_content:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="AI service returned empty response text.",
                )

            return text_content.strip()

        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            error_detail = "AI provider request failed."
            try:
                err_data = exc.response.json()
                if "error" in err_data and "message" in err_data["error"]:
                    error_detail = f"Gemini API Error: {err_data['error']['message']}"
            except Exception:
                pass

            if status_code in (401, 403) or "API_KEY_INVALID" in error_detail:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="AI service authentication failed. Invalid or unactivated LLM_API_KEY.",
                )
            elif status_code == 429:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="AI service rate limit exceeded. Please try again later.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_detail,
                )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="AI provider network request timed out.",
            )



class MockLLMProvider(BaseLLMProvider):
    """Mock LLM provider for isolated testing without paid external API calls."""

    def generate_text(self, system_prompt: str, user_prompt: str) -> str:
        return json.dumps(
            {
                "overview": "This document covers core principles of software engineering and design patterns.",
                "key_points": [
                    "Modularity improves code maintainability and testability.",
                    "Dependency injection decouples core components from external services.",
                    "Layered architecture separates presentation, business logic, and storage.",
                ],
                "important_terms": [
                    "Dependency Injection: Passing services as parameters rather than hardcoding them.",
                    "Encapsulation: Restricting direct access to internal component state.",
                ],
                "conclusion": "Adhering to these design principles leads to robust, scalable software systems.",
            }
        )


def get_llm_provider() -> BaseLLMProvider:
    provider_type = (settings.llm_provider or "gemini").lower()
    if provider_type == "mock":
        return MockLLMProvider()
    return GeminiProvider()
