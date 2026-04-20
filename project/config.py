"""Config for Swarm Factory."""
import os
from dotenv import load_dotenv

load_dotenv(override=False)

ANTHROPIC_API_KEY: str = os.environ["ANTHROPIC_API_KEY"]
CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
MAX_AGENT_TURNS: int = int(os.getenv("MAX_AGENT_TURNS", "40"))
