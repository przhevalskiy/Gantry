"""Complexity tier classifier — maps a goal string to a scaling tier."""
from __future__ import annotations
import re

# ── Keyword patterns per tier ─────────────────────────────────────────────────

_TIER3_PATTERNS = [
    r'\bsaas\b', r'\bplatform\b', r'\bmicroservice', r'\bpayments?\b',
    r'\bbilling\b', r'\bmulti.?service\b', r'\bproduction.?ready\b',
    r'\benterprise\b', r'\bmonorepo\b', r'\bfull.?stack\b',
    r'\bstripe\b', r'\bauth.{0,20}payment', r'\bmulti.?tenant\b',
]

_TIER1_PATTERNS = [
    r'\btic.?tac.?toe\b', r'\btodo\s+(app|list)\b', r'\blanding\s+page\b',
    r'\bcalculator\b', r'\bsnake\s+game\b', r'\bsimple\s+(app|game|tool|script|utility)\b',
    r'\bsingle.?page\b', r'\bstatic\s+site\b', r'\bprototype\b',
    r'\bpomodoro\b', r'\bclock\b', r'\btimer\b', r'\bcounter\b',
    r'\bgreeting\b', r'\bhello\s+world\b',
]

_TIER0_PATTERNS = [
    r'\bfix\s+(a\s+)?(bug|typo|error|issue|lint)\b',
    r'\brename\b', r'\badd\s+comment', r'\bbump\s+version',
    r'\bupdate\s+.*\bvariable\b', r'\bremove\s+unused\b',
    r'\bformat\b', r'\bclean\s+up\b',
]

# ── Per-tier params ───────────────────────────────────────────────────────────

TIER_PARAMS: dict[int, dict] = {
    0: {"lightweight_mode": True,  "max_parallel_tracks": 1, "max_heal_cycles": 0},
    1: {"lightweight_mode": True,  "max_parallel_tracks": 1, "max_heal_cycles": 1},
    2: {"lightweight_mode": False, "max_parallel_tracks": 2, "max_heal_cycles": 2},
    3: {"lightweight_mode": False, "max_parallel_tracks": 4, "max_heal_cycles": 2},
}

TIER_LABELS = {0: "Micro", 1: "Lightweight", 2: "Standard", 3: "Full Crew"}


def classify_tier(goal: str) -> int:
    lower = goal.lower()
    for p in _TIER3_PATTERNS:
        if re.search(p, lower):
            return 3
    for p in _TIER0_PATTERNS:
        if re.search(p, lower) and len(goal) < 100:
            return 0
    for p in _TIER1_PATTERNS:
        if re.search(p, lower):
            return 1
    return 2


def params_for_tier(tier: int) -> dict:
    return dict(TIER_PARAMS.get(tier, TIER_PARAMS[2]))
