"""
Build trace writer activity — Phase 5 (#14).

Writes structured decision traces to .gantry/traces/{task_id}.jsonl.
Each record captures one agent turn: agent name, turn number, tool called,
result summary, token count, and latency.

The trace file is human-readable JSONL — one JSON object per line.
The UI reads it via /api/traces to render the decision tree.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from temporalio import activity

_TRACES_DIR = ".gantry/traces"


@activity.defn(name="trace_write")
async def trace_write(
    repo_path: str,
    task_id: str,
    agent: str,
    turn: int,
    tool_name: str | None,
    tool_input_summary: str,
    tool_result_summary: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: int = 0,
    reasoning: str = "",
) -> str:
    """
    Append one agent decision record to the trace file.
    Non-blocking — failures are silently ignored.
    """
    try:
        traces_dir = Path(repo_path) / _TRACES_DIR
        traces_dir.mkdir(parents=True, exist_ok=True)
        trace_path = traces_dir / f"{task_id}.jsonl"

        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "agent": agent,
            "turn": turn,
            "tool": tool_name,
            "input": tool_input_summary[:400],
            "result": tool_result_summary[:400],
            "tokens": {"input": input_tokens, "output": output_tokens},
            "latency_ms": latency_ms,
            "reasoning": reasoning[:500],
        }

        with trace_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

        return f"Trace written: {agent} turn {turn}"
    except Exception as e:
        return f"Trace write failed (non-critical): {e}"


@activity.defn(name="trace_read")
async def trace_read(repo_path: str, task_id: str) -> str:
    """
    Read all trace records for a task. Returns JSON array string.
    """
    try:
        trace_path = Path(repo_path) / _TRACES_DIR / f"{task_id}.jsonl"
        if not trace_path.exists():
            return "[]"
        records = []
        for line in trace_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except Exception:
                    pass
        return json.dumps(records)
    except Exception:
        return "[]"
