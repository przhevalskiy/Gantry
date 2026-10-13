"""Gantry FastAPI application."""
import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import db
from api.config import GANTRY_DEV_AUTH_BYPASS, cors_settings
from api.middleware import RateLimitMiddleware
from api.repositories import keys as keys_repo
from api.routes import (
    agents,
    artifacts,
    audit,
    firm_packs,
    github,
    github_browser,
    integrations_jira,
    integrations_linear,
    internal,
    keys,
    org_settings,
    org_webhooks,
    playbooks,
    projects,
    quotas,
    secrets,
    status,
    tasks,
    ui_state,
    usage,
    workspaces,
)
from api.routes import projects_db
from api.services import poller

log = structlog.get_logger(__name__)
_poller_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _poller_task
    await db.init_pool()
    if db.is_available():
        migrated = await keys_repo.migrate_file_keys_to_db()
        if migrated:
            log.info("api_keys_migrated", count=migrated)
    _poller_task = asyncio.create_task(poller.run_poller())
    yield
    if _poller_task:
        _poller_task.cancel()
        try:
            await _poller_task
        except asyncio.CancelledError:
            pass
    await db.close_pool()


app = FastAPI(
    title="Gantry API",
    description="Durable multi-agent SWE pipeline — REST control plane",
    version="0.4.0",
    lifespan=lifespan,
)

_cors_origins, _cors_regex = cors_settings()
if not _cors_origins and not _cors_regex and not GANTRY_DEV_AUTH_BYPASS:
    log.warning(
        "cors_unconfigured",
        hint="Set GANTRY_CORS_ORIGINS or GANTRY_WEB_URL for browser clients",
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ([] if _cors_regex else ["*"]),
    allow_origin_regex=_cors_regex,
    allow_credentials=bool(_cors_origins or _cors_regex),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

app.include_router(status.router)
app.include_router(internal.router)
app.include_router(projects_db.router)
app.include_router(ui_state.router)
app.include_router(keys.router)
app.include_router(projects.router)
app.include_router(workspaces.router)
app.include_router(playbooks.router)
app.include_router(firm_packs.router)
app.include_router(artifacts.router)
app.include_router(agents.router)
app.include_router(tasks.router)
app.include_router(github.router)
app.include_router(github_browser.router)
app.include_router(secrets.router)
app.include_router(org_webhooks.router)
app.include_router(usage.router)
app.include_router(quotas.router)
app.include_router(audit.router)
app.include_router(integrations_linear.router)
app.include_router(integrations_jira.router)
app.include_router(org_settings.router)


@app.get("/health")
async def health():
    payload = {"status": "ok", "ok": True, "db": db.is_available()}
    if GANTRY_DEV_AUTH_BYPASS:
        payload["dev_auth_bypass"] = True
    return payload
