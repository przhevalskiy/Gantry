"""Config for Swarm Factory."""
import os
from dotenv import load_dotenv

load_dotenv(override=False)

ANTHROPIC_API_KEY: str = os.environ["ANTHROPIC_API_KEY"]
CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
CLAUDE_SONNET_MODEL: str = os.getenv("CLAUDE_SONNET_MODEL", CLAUDE_MODEL)
CLAUDE_HAIKU_MODEL: str = os.getenv("CLAUDE_HAIKU_MODEL", "claude-3-5-haiku-latest")
MAX_AGENT_TURNS: int = int(os.getenv("MAX_AGENT_TURNS", "24"))
MAX_CONTEXT_PAIRS: int = int(os.getenv("MAX_CONTEXT_PAIRS", "12"))  # keep last N tool call/result pairs

# GitHub integration — used by swarm_git_clone and swarm_git_configure_remote.
# Can be a classic PAT, fine-grained token, or OAuth token.
# Per-task tokens passed via task params take precedence over this global default.
GH_TOKEN: str = os.getenv("GH_TOKEN", os.getenv("GITHUB_TOKEN", ""))

# Mistral — alternative LLM provider. Set MISTRAL_API_KEY and pass a
# mistral-* model name to any planner activity to use Mistral instead of Claude.
# e.g. CLAUDE_SONNET_MODEL=mistral-large-latest in .env to route all agents to Mistral.
MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")

# Central episode store — shared across all repos on this machine.
# All completed builds append here; architect searches this for cross-repo learning.
from pathlib import Path as _Path
GANTRY_HOME: _Path = _Path(os.getenv("GANTRY_HOME", str(_Path.home() / ".gantry")))
