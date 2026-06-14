"""
Shared data models for the Durable Software Engineering Swarm.
Zero Temporal code. Zero Agentex SDK imports. (I1)
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


# ── Architect output ─────────────────────────────────────────────────────────

class FileNode(BaseModel):
    path: str
    language: str = "unknown"
    summary: str = ""
    dependencies: list[str] = []


class ArchitectPlan(BaseModel):
    """Codebase map + implementation plan produced by the Architect."""
    repo_root: str
    key_files: list[FileNode]
    entry_points: list[str]
    tech_stack: list[str]
    implementation_steps: list[str]   # ordered list of what the Builder should do
    notes: str = ""


# ── Builder output ───────────────────────────────────────────────────────────

class FileEdit(BaseModel):
    path: str
    operation: Literal["create", "modify", "delete"]
    content: str = ""
    description: str = ""


class BuildResult(BaseModel):
    success: bool
    edits: list[FileEdit]
    summary: str
    errors: list[str] = []


# ── Inspector output ─────────────────────────────────────────────────────────

class TestResult(BaseModel):
    passed: int
    failed: int
    errors: int
    output: str
    passed_all: bool


class InspectorReport(BaseModel):
    tests: TestResult | None = None
    lint_issues: list[str] = []
    type_errors: list[str] = []
    passed: bool
    summary: str
    heal_instructions: list[str] = []   # fed back to Builder if failed


# ── Security output ──────────────────────────────────────────────────────────

class SecurityFinding(BaseModel):
    severity: Literal["critical", "high", "medium", "low", "info"]
    category: str
    file: str = ""
    line: int = 0
    description: str
    recommendation: str = ""


class SecurityReport(BaseModel):
    findings: list[SecurityFinding]
    passed: bool   # True = no critical/high findings
    summary: str


# ── DevOps output ────────────────────────────────────────────────────────────

class DevOpsResult(BaseModel):
    branch: str
    commit_sha: str = ""
    pr_url: str = ""
    success: bool
    summary: str


# ── Swarm-level ledger ───────────────────────────────────────────────────────

class SwarmTask(BaseModel):
    """Top-level task submitted to the Foreman."""
    goal: str
    repo_path: str = "."
    branch_prefix: str = "swarm"
    max_heal_cycles: int = 3
    extra_context: dict[str, Any] = {}


class SwarmResult(BaseModel):
    """Final output from the Foreman after all agents complete."""
    success: bool
    goal: str
    architect_plan: ArchitectPlan | None = None
    build_result: BuildResult | None = None
    inspector_report: InspectorReport | None = None
    security_report: SecurityReport | None = None
    devops_result: DevOpsResult | None = None
    heal_cycles: int = 0
    summary: str
