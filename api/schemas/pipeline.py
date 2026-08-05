"""Pipeline customization passed through to the swarm orchestrator."""
from __future__ import annotations

from pydantic import BaseModel, Field

VALID_DISABLE_AGENTS = frozenset({"pm", "reviewer", "security", "inspector"})


class PipelineConfig(BaseModel):
    """Optional overrides for the swarm pipeline."""

    tier: int | None = Field(default=None, ge=-1, le=3)
    max_parallel_tracks: int | None = Field(default=None, ge=1, le=8)
    max_heal_cycles: int | None = Field(default=None, ge=0, le=5)
    lightweight_mode: bool | None = None
    disable_agents: list[str] = Field(default_factory=list)

    def to_agentex_params(self) -> dict:
        params: dict = {}
        if self.tier is not None and self.tier >= 0:
            params["tier"] = self.tier
        if self.max_parallel_tracks is not None:
            params["max_parallel_tracks"] = self.max_parallel_tracks
        if self.max_heal_cycles is not None:
            params["max_heal_cycles"] = self.max_heal_cycles
        if self.lightweight_mode is not None:
            params["lightweight_mode"] = self.lightweight_mode
        if self.disable_agents:
            invalid = set(self.disable_agents) - VALID_DISABLE_AGENTS
            if invalid:
                raise ValueError(f"invalid disable_agents: {sorted(invalid)}")
            params["disable_agents"] = self.disable_agents
        return params
