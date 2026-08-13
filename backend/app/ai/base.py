from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    """Abstract interface for LLM provider implementations (Gemini, OpenAI, Mock, etc.)."""

    @abstractmethod
    def generate_text(self, system_prompt: str, user_prompt: str) -> str:
        """Sends system and user prompts to the LLM and returns raw text response."""
        pass
