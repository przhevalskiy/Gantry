"""Per-org and per-task LLM configuration."""
from __future__ import annotations

from pydantic import BaseModel, Field

VALID_LLM_PROVIDERS = frozenset({"anthropic", "mistral", "openai"})


class LlmConfig(BaseModel):
    """LLM provider + model overrides. API keys reference org secrets or inline (discouraged)."""

    provider: str | None = Field(default=None, description="anthropic | mistral | openai")
    api_key: str | None = Field(default=None, description="Inline key — prefer api_key_secret")
    api_key_secret: str | None = Field(default=None, description="Name of org secret holding the provider API key")
    sonnet_model: str | None = Field(default=None, description="Primary/heavy model (tier 2+ agents)")
    haiku_model: str | None = Field(default=None, description="Fast/cheap model (tier 0–1 agents)")
    openai_base_url: str | None = Field(
        default=None,
        description="OpenAI-compatible base URL (Ollama, vLLM, Azure, Together)",
    )

    def validate_provider(self) -> None:
        if self.provider and self.provider not in VALID_LLM_PROVIDERS:
            raise ValueError(f"invalid provider: {self.provider}")
