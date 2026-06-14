import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=False)

GANTRY_API_PORT: int = int(os.getenv("GANTRY_API_PORT", "8001"))
AGENTEX_BASE_URL: str = os.getenv("AGENTEX_BASE_URL", "http://localhost:5003")
GANTRY_UI_URL: str = os.getenv("GANTRY_UI_URL", "http://localhost:3000")
TEMPORAL_ADDRESS: str = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
TEMPORAL_NAMESPACE: str = os.getenv("TEMPORAL_NAMESPACE", "default")
AGENT_NAME: str = os.getenv("GANTRY_AGENT_NAME", "swarm-factory")

# Webhook signing secret — generated once, stored in ~/.gantry/webhook_secret
GANTRY_HOME: Path = Path(os.getenv("GANTRY_HOME", str(Path.home() / ".gantry")))
KEYS_PATH: Path = GANTRY_HOME / "api_keys.json"
TASKS_PATH: Path = GANTRY_HOME / "api_tasks.json"
WEBHOOK_SECRET_PATH: Path = GANTRY_HOME / "webhook_secret"

GITHUB_WEBHOOK_SECRET: str = os.getenv("GITHUB_WEBHOOK_SECRET", "")
GH_TOKEN: str = os.getenv("GH_TOKEN", os.getenv("GITHUB_TOKEN", ""))

# Postgres — required for multi-user production; optional in local dev
DATABASE_URL: str = os.getenv("DATABASE_URL", "")

# Clerk — required for auth in production
CLERK_SECRET_KEY: str = os.getenv("CLERK_SECRET_KEY", "")
