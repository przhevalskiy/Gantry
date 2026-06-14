"""Async Postgres connection pool.

Initialised once at FastAPI startup via lifespan. All route handlers
call `get_conn()` to acquire a connection from the pool.

If DATABASE_URL is not set the pool is None and routes that require
the DB return 503 — this keeps local dev (registry.json mode) working.
"""
from __future__ import annotations

import structlog
from contextlib import asynccontextmanager
from typing import AsyncIterator

from api.config import DATABASE_URL

log = structlog.get_logger(__name__)

_pool = None  # psycopg_pool.AsyncConnectionPool | None


async def init_pool() -> None:
    global _pool
    if not DATABASE_URL:
        log.warning("db_no_url", msg="DATABASE_URL not set — running in local/registry mode")
        return
    try:
        from psycopg_pool import AsyncConnectionPool
        _pool = AsyncConnectionPool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            open=False,
        )
        await _pool.open()
        log.info("db_pool_ready")
    except Exception as exc:
        log.error("db_pool_failed", error=str(exc))
        _pool = None


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def is_available() -> bool:
    return _pool is not None


@asynccontextmanager
async def get_conn() -> AsyncIterator:
    if _pool is None:
        raise RuntimeError("No database connection pool available")
    async with _pool.connection() as conn:
        yield conn


async def execute(query: str, params: tuple = ()) -> None:
    async with get_conn() as conn:
        await conn.execute(query, params)


async def fetch_one(query: str, params: tuple = ()) -> dict | None:
    from psycopg.rows import dict_row
    async with get_conn() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(query, params)
            return await cur.fetchone()


async def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    from psycopg.rows import dict_row
    async with get_conn() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(query, params)
            return await cur.fetchall()
