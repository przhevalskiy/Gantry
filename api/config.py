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

# GitHub App — preferred over PAT-per-task for platform integrations
GITHUB_APP_ID: str = os.getenv("GITHUB_APP_ID", "")
GITHUB_APP_SLUG: str = os.getenv("GITHUB_APP_SLUG", "gantry")
GITHUB_APP_PRIVATE_KEY: str = os.getenv("GITHUB_APP_PRIVATE_KEY", "")
GITHUB_APP_WEBHOOK_SECRET: str = os.getenv("GITHUB_APP_WEBHOOK_SECRET", GITHUB_WEBHOOK_SECRET)
GANTRY_PUBLIC_URL: str = os.getenv("GANTRY_PUBLIC_URL", f"http://localhost:{GANTRY_API_PORT}")

# Postgres — required for multi-user production; optional in local dev
DATABASE_URL: str = os.getenv("DATABASE_URL", "")

# Bootstrap token — required to create the first API key when GANTRY_BOOTSTRAP_TOKEN is set
GANTRY_BOOTSTRAP_TOKEN: str = os.getenv("GANTRY_BOOTSTRAP_TOKEN", "")

GANTRY_INSTALL_STATE_SECRET: str = os.getenv(
    "GANTRY_INSTALL_STATE_SECRET",
    os.getenv("GANTRY_BOOTSTRAP_TOKEN", ""),
)

# Fernet key for org secrets — generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
GANTRY_SECRETS_KEY: str = os.getenv("GANTRY_SECRETS_KEY", "")

# Clerk — required for auth in production
CLERK_SECRET_KEY: str = os.getenv("CLERK_SECRET_KEY", "")
