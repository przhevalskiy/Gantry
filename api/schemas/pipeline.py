"""Pipeline customization passed through to the swarm orchestrator."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from schemas.playbooks import (
    ARTIFACT_TYPES,
    KNOWN_CREW_ROLES,
    MUTABLE_CREW_ROLES,
    normalize_artifact_type,
)

VALID_DISABLE_AGENTS = MUTABLE_CREW_ROLES


class PipelineConfig(BaseModel):
    """Optional overrides for the swarm pipeline (Phase B: artifact + seat mute)."""

    tier: int | None = Field(default=None, ge=-1, le=3)
    max_parallel_tracks: int | None = Field(default=None, ge=1, le=8)
    max_heal_cycles: int | None = Field(default=None, ge=0, le=5)
    lightweight_mode: bool | None = None
    disable_agents: list[str] = Field(default_factory=list)
    include_agents: list[str] = Field(default_factory=list)
    # Playbook/job finish policy — pr (default) | branch | patch | report
    artifact: str | dict[str, Any] | None = None

    @field_validator("disable_agents")
    @classmethod
    def _valid_disable(cls, value: list[str]) -> list[str]:
        invalid = {str(x).lower() for x in value} - VALID_DISABLE_AGENTS
        if invalid:
            raise ValueError(f"invalid disable_agents: {sorted(invalid)}")
        return [str(x).lower() for x in value]

    @field_validator("include_agents")
    @classmethod
    def _valid_include(cls, value: list[str]) -> list[str]:
        invalid = {str(x).lower() for x in value} - KNOWN_CREW_ROLES
        if invalid:
            raise ValueError(f"invalid include_agents: {sorted(invalid)}")
        return [str(x).lower() for x in value]

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
            params["disable_agents"] = list(self.disable_agents)
        if self.include_agents:
            params["include_agents"] = list(self.include_agents)
        if self.artifact is not None:
            params["artifact"] = (
                self.artifact
                if isinstance(self.artifact, dict)
                else {"type": normalize_artifact_type(self.artifact)}
            )
            # Reject unknown types early (normalize would default; validate explicitly).
            raw = (
                self.artifact.get("type")
                if isinstance(self.artifact, dict)
                else self.artifact
            )
            if raw is not None and str(raw).lower() not in ARTIFACT_TYPES:
                raise ValueError(
                    f"artifact.type must be one of: {', '.join(sorted(ARTIFACT_TYPES))}"
                )
        return params
