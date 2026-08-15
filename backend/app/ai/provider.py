import json
import logging
from typing import Any

from fastapi import HTTPException, status
import httpx

from app.ai.base import BaseLLMProvider
from app.core.config import settings

logger = logging.getLogger("ai_study_assistant")


class GeminiProvider(BaseLLMProvider):
    """Google Gemini LLM provider implementation using direct REST API calls with resilient model fallback."""

    FALLBACK_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"]

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model or "gemini-flash-latest"

    def generate_text(
        self, system_prompt: str, user_prompt: str, response_mime_type: str | None = None
    ) -> str:
        if (
            not self.api_key
            or "YOUR_GEMINI_API_KEY" in self.api_key
            or "your_gemini_api_key_here" in self.api_key
        ):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service unavailable. Please set a valid LLM_API_KEY in your .env file.",
            )

        headers = {"Content-Type": "application/json"}
        gen_config: dict[str, Any] = {"temperature": 0.2}
        if response_mime_type:
            gen_config["response_mime_type"] = response_mime_type

        payload: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": gen_config,
        }

        # Build prioritized list of models to try (primary model first, then fallbacks)
        models_to_try = [self.model]
        for m in self.FALLBACK_MODELS:
            if m not in models_to_try:
                models_to_try.append(m)

        last_error_detail = "AI service request failed."
        last_status_code = status.HTTP_502_BAD_GATEWAY

        for model_name in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
            try:
                with httpx.Client(timeout=35.0) as client:
                    response = client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    data = response.json()

                candidates = data.get("candidates", [])
                if not candidates:
                    continue

                text_content = (
                    candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                )
                if text_content:
                    return text_content.strip()

            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                error_detail = f"Gemini API Error ({model_name}): {status_code}"
                try:
                    err_data = exc.response.json()
                    if "error" in err_data and "message" in err_data["error"]:
                        error_detail = f"Gemini API Error: {err_data['error']['message']}"
                except Exception:
                    pass

                logger.warning("Model %s failed with %s. Trying next fallback if available...", model_name, error_detail)
                last_error_detail = error_detail

                if status_code in (401, 403) or "API_KEY_INVALID" in error_detail:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="AI service authentication failed. Invalid or unactivated LLM_API_KEY.",
                    )
                elif status_code == 429:
                    last_status_code = status.HTTP_429_TOO_MANY_REQUESTS
                else:
                    last_status_code = status.HTTP_502_BAD_GATEWAY

            except httpx.RequestError as exc:
                logger.warning("Network error calling model %s: %s", model_name, exc)
                last_error_detail = f"AI provider network timeout on {model_name}."
                last_status_code = status.HTTP_504_GATEWAY_TIMEOUT

        # If all candidate models failed
        raise HTTPException(
            status_code=last_status_code,
            detail=last_error_detail,
        )


class MockLLMProvider(BaseLLMProvider):
    """Mock LLM provider for isolated testing without paid external API calls."""

    def generate_text(
        self, system_prompt: str, user_prompt: str, response_mime_type: str | None = None
    ) -> str:
        if response_mime_type == "application/json":
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
        return "Based on the retrieved document context, software engineering emphasizes systematic design patterns and modularity."


def get_llm_provider() -> BaseLLMProvider:
    provider_type = (settings.llm_provider or "gemini").lower()
    if provider_type == "mock":
        return MockLLMProvider()
    return GeminiProvider()
