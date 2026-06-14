"""
Healing and failure-recovery helpers for SwarmOrchestrator.

Extracted from workflows/swarm_orchestrator.py — pure functions, no Temporal imports.
"""
from __future__ import annotations

import re


def _parse_failing_tests(output: str) -> list[str]:
    """
    Extract failing test IDs from a test runner's stdout.

    Handles pytest ("FAILED tests/foo.py::test_bar") and
    Jest/Vitest ("✕ test name" / "FAIL src/foo.test.ts").
    Returns at most 50 IDs to avoid oversized payloads.
    """
    ids: list[str] = []
    # pytest: "FAILED path/to/test.py::test_name [...]"
    ids.extend(re.findall(r"^FAILED\s+(\S+)", output, re.MULTILINE))
    # jest/vitest: "FAIL src/foo.test.ts"
    ids.extend(re.findall(r"^FAIL\s+(\S+\.(?:test|spec)\.\w+)", output, re.MULTILINE))
    # jest inline: "  ✕ some test description (42 ms)"
    ids.extend(re.findall(r"^\s+[✕✗×]\s+(.+?)\s*\(\d+", output, re.MULTILINE))
    seen: set[str] = set()
    unique = [x for x in ids if x not in seen and not seen.add(x)]  # type: ignore[func-returns-value]
    return unique[:50]
