"""
Build quality scoring activity — Phase 5 (#15).

After DevOps completes, runs a lightweight LLM eval (Haiku) that scores
the build 0–10 on goal alignment, completeness, and code quality.
The score is stored in the episodic memory record for future Architect context.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import anthropic
from temporalio import activity

from project.config import ANTHROPIC_API_KEY, CLAUDE_HAIKU_MODEL

_SYSTEM = (
    "You are a build quality evaluator. Given a goal and a sample of the code produced, "
    "score the build 0–10 on three dimensions and return JSON only.\n"
    "Respond with exactly: {\"score\": <0-10>, \"alignment\": <0-10>, \"completeness\": <0-10>, "
    "\"quality\": <0-10>, \"reasoning\": \"<one sentence>\"}"
)

_SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", ".next", "dist", "build", ".gantry"}
_SKIP_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".ttf", ".lock", ".bin", ".pyc", ".map"}
_MAX_SAMPLE_CHARS = 6000


def _sample_repo(repo_path: str, edited_paths: list[str]) -> str:
    """
    Return a compact sample of the written code for the evaluator.
    Prioritises files that were actually edited, falls back to any source files.
    """
    base = Path(repo_path)
    samples: list[str] = []
    total = 0

    # First: files that were actually written
    for rel in edited_paths[:8]:
        abs_path = base / rel if not rel.startswith("/") else Path(rel)
        if not abs_path.exists() or abs_path.suffix.lower() in _SKIP_EXTS:
            continue
        try:
            content = abs_path.read_text(encoding="utf-8", errors="ignore")[:800]
            samples.append(f"--- {rel} ---\n{content}")
            total += len(content)
            if total > _MAX_SAMPLE_CHARS:
                break
        except Exception:
            continue

    # Fallback: any source files if we have room
    if total < _MAX_SAMPLE_CHARS // 2:
        for p in sorted(base.rglob("*"))[:30]:
            if any(part in _SKIP_DIRS for part in p.parts):
                continue
            if not p.is_file() or p.suffix.lower() in _SKIP_EXTS:
                continue
            try:
                content = p.read_text(encoding="utf-8", errors="ignore")[:400]
                rel = str(p.relative_to(base))
                samples.append(f"--- {rel} ---\n{content}")
                total += len(content)
                if total > _MAX_SAMPLE_CHARS:
                    break
            except Exception:
                continue

    return "\n\n".join(samples) if samples else "(no source files found)"


@activity.defn(name="score_build_quality")
async def score_build_quality(
    goal: str,
    repo_path: str,
    edited_paths: list[str],
    inspector_passed: bool,
    heal_cycles: int,
    files_modified: int,
) -> dict:
    """
    Score a completed build 0–10 using Haiku.
    Returns {score, alignment, completeness, quality, reasoning}.
    Non-blocking — returns a default score on any failure.
    """
    try:
        code_sample = _sample_repo(repo_path, edited_paths)

        prompt = (
            f"Goal: {goal[:400]}\n\n"
            f"Build stats: {files_modified} files modified, "
            f"{heal_cycles} heal cycle(s), "
            f"inspector {'passed' if inspector_passed else 'failed'}.\n\n"
            f"Code sample:\n{code_sample[:_MAX_SAMPLE_CHARS]}"
        )

        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model=CLAUDE_HAIKU_MODEL,
            max_tokens=256,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip() if response.content else ""
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        result = json.loads(text)
        score = max(0, min(10, float(result.get("score", 5))))
        return {
            "score": round(score, 1),
            "alignment": round(max(0, min(10, float(result.get("alignment", score)))), 1),
            "completeness": round(max(0, min(10, float(result.get("completeness", score)))), 1),
            "quality": round(max(0, min(10, float(result.get("quality", score)))), 1),
            "reasoning": str(result.get("reasoning", ""))[:300],
        }

    except Exception as e:
        # Non-critical — return a neutral score rather than failing the build
        return {
            "score": 5.0,
            "alignment": 5.0,
            "completeness": 5.0,
            "quality": 5.0,
            "reasoning": f"Scoring unavailable: {str(e)[:100]}",
        }
