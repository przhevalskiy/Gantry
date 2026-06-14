"""Internal endpoints — called by Next.js server-side routes, not public callers.

Next.js runs on Vercel and cannot reach Temporal's gRPC port directly.
These endpoints act as a proxy: Next.js → Gantry API → Temporal.
Authenticated by INTERNAL_API_KEY (shared secret, never exposed to browsers).
"""
import json
import os
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from api import db
from api.clients import temporal as temporal_client

router = APIRouter(prefix="/internal", tags=["Internal"])

_INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")


def _check(key: str | None) -> None:
    if not _INTERNAL_KEY:
        return  # not configured — allow (dev mode)
    if key != _INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal key")


@router.post("/signal")
async def proxy_signal(
    body: dict,
    x_internal_key: str | None = Header(default=None),
):
    """Proxy a Temporal workflow signal from Next.js."""
    _check(x_internal_key)

    workflow_id = body.get("workflow_id")
    signal_name = body.get("signal", "approve")
    payload = body.get("payload")

    if payload is None:
        payload = body.get("approved")
    if not workflow_id:
        raise HTTPException(status_code=400, detail="workflow_id required")

    try:
        await temporal_client.signal_workflow(workflow_id, signal_name, payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"ok": True}


_SKIP = {".git", "node_modules", ".next", "dist", "build", "__pycache__", ".venv", "coverage"}


def _walk(directory: Path, root: Path, depth: int = 0) -> list[str]:
    if depth > 8:
        return []
    out: list[str] = []
    try:
        for entry in sorted(directory.iterdir()):
            if entry.name in _SKIP or entry.name.startswith("."):
                continue
            try:
                if entry.is_dir():
                    out.extend(_walk(entry, root, depth + 1))
                else:
                    out.append(str(entry.relative_to(root)))
            except (PermissionError, OSError):
                pass
    except (PermissionError, OSError):
        pass
    return out


@router.get("/files/tree")
async def files_tree(
    root: str,
    x_internal_key: str | None = Header(default=None),
):
    """Return the file tree for a repo path."""
    _check(x_internal_key)
    p = Path(root)
    if not p.exists() or not p.is_dir():
        return JSONResponse({"files": []})
    return JSONResponse({"files": _walk(p, p)})


@router.get("/files/content")
async def files_content(
    path: str,
    x_internal_key: str | None = Header(default=None),
):
    """Return the content of a single file."""
    _check(x_internal_key)
    p = Path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        return JSONResponse({"content": p.read_text(encoding="utf-8", errors="replace")})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/traces")
async def traces(
    task_id: str,
    repo_path: str | None = None,
    x_internal_key: str | None = Header(default=None),
):
    """Return trace records for a task (reads from worker disk)."""
    _check(x_internal_key)
    gantry_home = os.getenv("GANTRY_HOME", str(Path.home() / ".gantry"))
    traces_dir = (
        Path(repo_path) / ".gantry" / "traces"
        if repo_path
        else Path(gantry_home) / "traces"
    )
    trace_file = traces_dir / f"{task_id}.jsonl"
    if not trace_file.exists():
        return JSONResponse([])
    records = []
    for line in trace_file.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except Exception:
            pass
    return JSONResponse(records)


@router.get("/projects/{project_id}/memory")
async def project_memory(
    project_id: str,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    """Return project memory (facts + episodes) read from the worker disk."""
    _check(x_internal_key)

    # Look up repo_path from DB
    repo_path: str | None = None
    if db.is_available():
        row = await db.fetch_one(
            "SELECT repo_path FROM projects WHERE id = %s AND user_id = %s",
            (project_id, x_user_id),
        )
        if row:
            repo_path = row["repo_path"]

    if not repo_path:
        raise HTTPException(status_code=404, detail="project not found")

    mem_dir = Path(repo_path) / ".gantry" / "memory"
    facts: dict = {}
    facts_path = mem_dir / "facts.json"
    if facts_path.exists():
        try:
            facts = json.loads(facts_path.read_text())
        except Exception:
            facts = {}

    episodes: list = []
    episodes_total = 0
    episodes_path = mem_dir / "episodes.jsonl"
    if episodes_path.exists():
        try:
            all_eps = [
                json.loads(line)
                for line in episodes_path.read_text().splitlines()
                if line.strip()
            ]
            episodes_total = len(all_eps)
            episodes = list(reversed(all_eps[-20:]))
        except Exception:
            episodes = []

    return JSONResponse({
        "project_id": project_id,
        "repo_path": repo_path,
        "facts": facts,
        "episodes": episodes,
        "facts_count": len(facts),
        "episodes_count": episodes_total,
    })
