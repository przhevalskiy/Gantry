"""Shared types for the planner layer."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class PlannerStep:
    tool_name: str
    tool_use_id: str
    tool_input: dict[str, Any]


@dataclass
class FinalAnswer:
    answer: str


class PlannerError(Exception):
    """Raised when the planner cannot complete a step."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


PlannerResult = PlannerStep | FinalAnswer | PlannerError
