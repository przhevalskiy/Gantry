"""
Episodic memory activities — shared infrastructure for all swarm agents.

Two layers:
  facts.json     — structured key/value facts, written by any agent during a build
  episodes.jsonl — one JSON line per completed build, written by the orchestrator

Per-repo files live under .gantry/memory/ relative to repo_path.
Central platform file lives at $GANTRY_HOME/episodes.jsonl — shared across ALL repos
and ALL builds on this machine. The architect searches this for cross-repo learning.
"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

from temporalio import activity

from project.config import GANTRY_HOME

_MEMORY_DIR = ".gantry/memory"
_FACTS_FILE = "facts.json"
_EPISODES_FILE = "episodes.jsonl"

# Central platform-wide episode store
_CENTRAL_EPISODES: Path = GANTRY_HOME / _EPISODES_FILE


def _memory_dir(repo_path: str) -> Path:
    p = Path(repo_path) / _MEMORY_DIR
    p.mkdir(parents=True, exist_ok=True)
    return p


def _central_dir() -> Path:
    GANTRY_HOME.mkdir(parents=True, exist_ok=True)
    return GANTRY_HOME


def _append_jsonl(path: Path, record: dict) -> None:
    with path.open("a") as f:
        f.write(json.dumps(record) + "\n")


def _load_jsonl(path: Path) -> list[dict]:
    episodes: list[dict] = []
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if line:
                episodes.append(json.loads(line))
    except Exception:
        pass
    return episodes


# ── Facts ─────────────────────────────────────────────────────────────────────

@activity.defn(name="memory_write_fact")
async def memory_write_fact(
    repo_path: str,
    key: str,
    value: str,
    agent: str = "unknown",
    confidence: float = 1.0,
) -> str:
    """Upsert a durable fact into facts.json."""
    facts_path = _memory_dir(repo_path) / _FACTS_FILE
    try:
        data: dict = json.loads(facts_path.read_text()) if facts_path.exists() else {}
    except Exception:
        data = {}
    data[key] = {
        "value": value,
        "agent": agent,
        "confidence": round(confidence, 2),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    facts_path.write_text(json.dumps(data, indent=2))
    return f"Fact '{key}' stored by {agent}."


@activity.defn(name="memory_read_facts")
async def memory_read_facts(repo_path: str, keys: list[str] | None = None) -> str:
    """
    Return all facts (or a subset by key list) as a formatted string.
    Facts older than TTL_DAYS are flagged as stale for architectural keys
    (prefixed with 'arch.' or 'pm.') and excluded from the default view.
    """
    TTL_DAYS = 90
    facts_path = _memory_dir(repo_path) / _FACTS_FILE
    if not facts_path.exists():
        return "No facts stored yet."
    try:
        data: dict = json.loads(facts_path.read_text())
    except Exception:
        return "Error reading facts (malformed JSON)."

    now = datetime.now(timezone.utc)
    subset = {k: v for k, v in data.items() if k in keys} if keys else data

    if not subset:
        return "No matching facts found."

    lines = []
    stale_keys: list[str] = []
    for k, v in subset.items():
        if isinstance(v, dict):
            updated_at = v.get("updated_at", "")
            is_stale = False
            if updated_at and k.startswith(("arch.", "pm.")):
                try:
                    age = now - datetime.fromisoformat(updated_at)
                    if age.days > TTL_DAYS:
                        is_stale = True
                        stale_keys.append(k)
                except Exception:
                    pass
            if is_stale:
                continue
            lines.append(f"**{k}** [{v.get('agent', '?')}]: {v.get('value', '')}")
        else:
            lines.append(f"**{k}**: {v}")

    if stale_keys:
        lines.append(
            f"\n[{len(stale_keys)} stale fact(s) excluded (>{TTL_DAYS}d old): "
            + ", ".join(stale_keys[:5])
            + "]"
        )

    return "\n".join(lines) if lines else "No active facts found (all may be stale)."


# ── Episodes ──────────────────────────────────────────────────────────────────

@activity.defn(name="memory_append_episode")
async def memory_append_episode(repo_path: str, episode: dict) -> str:
    """
    Append one completed-build record to two places:
      1. Per-repo  — {repo_path}/.gantry/memory/episodes.jsonl  (repo-local context)
      2. Central   — $GANTRY_HOME/episodes.jsonl                 (cross-repo flywheel)
    """
    episode.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    episode.setdefault("repo_path", repo_path)

    # Per-repo write (existing behaviour)
    _append_jsonl(_memory_dir(repo_path) / _EPISODES_FILE, episode)

    # Central write — silently skip if filesystem is read-only or misconfigured
    try:
        _append_jsonl(_central_dir() / _EPISODES_FILE, episode)
    except Exception:
        pass

    return f"Episode recorded ({episode.get('outcome', 'unknown')})."


@activity.defn(name="memory_search_episodes")
async def memory_search_episodes(repo_path: str, query: str, top_k: int = 5) -> str:
    """
    BM25-style keyword search over past build episodes.

    Searches the central platform store ($GANTRY_HOME/episodes.jsonl) first so the
    architect benefits from every prior build across ALL repos on this machine.
    Falls back to the per-repo store if the central file is missing or empty.

    Returns up to top_k relevant episodes as formatted text, tagged with their
    source repo so the architect can judge relevance.
    """
    # Prefer central store (cross-repo); fall back to per-repo
    central_path = _central_dir() / _EPISODES_FILE
    local_path = _memory_dir(repo_path) / _EPISODES_FILE

    if central_path.exists() and central_path.stat().st_size > 0:
        episodes = _load_jsonl(central_path)
        source = "platform"
    elif local_path.exists():
        episodes = _load_jsonl(local_path)
        source = "repo"
    else:
        return "No past episodes recorded yet."

    if not episodes:
        return "No past episodes recorded yet."

    query_terms = set(re.findall(r"\w+", query.lower()))

    def _score(ep: dict) -> float:
        text = json.dumps(ep).lower()
        words = re.findall(r"\w+", text)
        total = len(words) or 1
        score = 0.0
        for term in query_terms:
            tf = words.count(term) / total
            idf = math.log(1 + len(episodes))
            score += tf * idf
        # Boost episodes from the same repo slightly
        if ep.get("repo_path") == repo_path:
            score *= 1.25
        return score

    ranked = sorted(episodes, key=_score, reverse=True)[:top_k]

    scope = "cross-repo platform" if source == "platform" else "this repo"
    lines = [f"### Past Episodes (top {len(ranked)} matches for: {query!r} — {scope})\n"]
    for ep in ranked:
        ts = ep.get("timestamp", "?")[:10]
        goal = ep.get("goal", "?")[:120]
        outcome = ep.get("outcome", "?")
        tier = ep.get("tier_label", ep.get("tier", "?"))
        decisions = ep.get("key_decisions", [])
        quality = ep.get("quality_score")
        repo = ep.get("repo_path", "")
        repo_name = Path(repo).name if repo else ""

        header = f"**[{ts}] {outcome} | tier={tier}"
        if quality is not None:
            header += f" | quality={quality}/10"
        if repo_name and repo != repo_path:
            header += f" | repo={repo_name}"
        header += "**"

        lines.append(header)
        lines.append(f"Goal: {goal}")
        if decisions:
            lines.append("Decisions: " + "; ".join(str(d) for d in decisions[:3]))
        lines.append("")

    return "\n".join(lines)
