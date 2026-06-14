"""Gantry FastAPI application."""
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import db
from api.routes import internal, keys, projects, tasks, github
from api.routes import projects_db, ui_state

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_pool()
    yield
    await db.close_pool()


app = FastAPI(
    title="Gantry API",
    description="Autonomous engineering factory — REST layer",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(internal.router)
app.include_router(projects_db.router)
app.include_router(ui_state.router)
app.include_router(keys.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(github.router)


@app.get("/health")
async def health():
    return {"ok": True, "db": db.is_available()}
