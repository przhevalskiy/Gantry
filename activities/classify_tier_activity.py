"""
Tier classification activity — replaces brittle regex with a fast LLM call.
Uses Haiku for speed and cost efficiency (~500 tokens, ~2s).
Returns {tier, estimated_files, estimated_minutes, risk_flags, reasoning}.
"""
from __future__ import annotations

import json

import anthropic
from temporalio import activity

from project.config import ANTHROPIC_API_KEY, CLAUDE_HAIKU_MODEL

_SYSTEM = (
    "You are a software project complexity classifier. "
    "Given a goal description, classify it into one of four tiers and provide estimates. "
    "Respond ONLY with valid JSON — no prose, no markdown fences."
)

_PROMPT_TEMPLATE = """Classify this software engineering goal into a complexity tier.

GOAL:
{goal}

TIERS:
- 0 (Micro): Single-file fix, rename, typo, comment, format. < 5 files touched. < 5 min.
- 1 (Lightweight): Simple app, single feature, small script. 5–20 files. 5–15 min.
- 2 (Standard): Multi-file feature, API integration, moderate refactor. 20–60 files. 15–45 min.
- 3 (Full Crew): Full-stack feature, SaaS, payments, auth system, multi-service, production-ready. 60+ files. 45+ min.

Respond with JSON only:
{{
  "tier": <0|1|2|3>,
  "estimated_files": <integer>,
  "estimated_minutes": <integer>,
  "risk_flags": [<list of short risk strings, empty if none>],
  "reasoning": "<one sentence>"
}}"""


@activity.defn(name="classify_tier_llm")
async def classify_tier_llm(goal: str) -> dict:
    """
    Use Haiku to classify goal complexity into a tier.
    Falls back to regex-based classification if the LLM call fails.
    Returns {tier, estimated_files, estimated_minutes, risk_flags, reasoning}.
    """
    from project.complexity import classify_tier as _regex_classify  # fallback

    try:
        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model=CLAUDE_HAIKU_MODEL,
            max_tokens=256,
            system=_SYSTEM,
            messages=[{"role": "user", "content": _PROMPT_TEMPLATE.format(goal=goal[:1000])}],
        )
        text = response.content[0].text.strip() if response.content else ""
        # Strip markdown fences if the model adds them despite instructions
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text)
        tier = int(result.get("tier", 2))
        if tier not in (0, 1, 2, 3):
            tier = 2
        return {
            "tier": tier,
            "estimated_files": int(result.get("estimated_files", 0)),
            "estimated_minutes": int(result.get("estimated_minutes", 0)),
            "risk_flags": result.get("risk_flags", []),
            "reasoning": result.get("reasoning", ""),
            "source": "llm",
        }
    except Exception as e:
        # Graceful fallback — regex classifier is always available
        fallback_tier = _regex_classify(goal)
        return {
            "tier": fallback_tier,
            "estimated_files": 0,
            "estimated_minutes": 0,
            "risk_flags": [],
            "reasoning": f"LLM classification failed ({e}), used regex fallback.",
            "source": "regex_fallback",
        }
