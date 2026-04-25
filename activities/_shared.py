"""
Shared infrastructure for all swarm activity modules.
Provides: _run(), per-file asyncio write locks, and the module logger.
"""
from __future__ import annotations

import asyncio
import subprocess
import threading as _threading
from pathlib import Path

import structlog
from temporalio import activity  # noqa: F401  (re-exported so callers can `from ._shared import activity`)

# ── Per-file write lock registry ──────────────────────────────────────────────
# Prevents two parallel builder activities from writing the same file
# simultaneously. All builder activities run in the same worker process, so
# a process-level asyncio.Lock per absolute path is sufficient.

_FILE_LOCKS: dict[str, asyncio.Lock] = {}
_FILE_LOCKS_META: dict[str, str] = {}  # path → current owner (track label)
_REGISTRY_LOCK = _threading.Lock()     # protects _FILE_LOCKS dict itself


def _get_file_lock(path: str) -> asyncio.Lock:
    abs_path = str(Path(path).resolve())
    with _REGISTRY_LOCK:
        if abs_path not in _FILE_LOCKS:
            _FILE_LOCKS[abs_path] = asyncio.Lock()
        return _FILE_LOCKS[abs_path]


def _log_collision(path: str, requester: str) -> None:
    abs_path = str(Path(path).resolve())
    current_owner = _FILE_LOCKS_META.get(abs_path, "unknown")
    logger.warning(
        "file_write_collision",
        path=abs_path,
        blocked_by=current_owner,
        requester=requester,
    )


async def _acquire_write_lock(path: str, owner: str = "unknown") -> asyncio.Lock:
    lock = _get_file_lock(path)
    abs_path = str(Path(path).resolve())
    if lock.locked():
        _log_collision(path, owner)
    await lock.acquire()
    _FILE_LOCKS_META[abs_path] = owner
    return lock


def _release_write_lock(path: str) -> None:
    lock = _get_file_lock(path)
    abs_path = str(Path(path).resolve())
    _FILE_LOCKS_META.pop(abs_path, None)
    try:
        lock.release()
    except RuntimeError:
        pass


logger = structlog.get_logger(__name__)


# ── Subprocess helper ─────────────────────────────────────────────────────────

def _run(cmd: str, cwd: str | None = None, timeout: int = 120, env: dict | None = None) -> dict:
    """Run a shell command and return {stdout, stderr, returncode}."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            cwd=cwd or ".",
            timeout=timeout,
            env=env,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": f"Command timed out after {timeout}s", "returncode": -1}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": -1}
