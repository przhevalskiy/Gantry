"""Safe file access scoped to a project workspace."""
from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

_SKIP = {".git", "node_modules", ".next", "dist", "build", "__pycache__", ".venv", "coverage", ".gantry"}


def project_root(project: dict) -> Path:
    repo_path = project.get("repo_path")
    if not repo_path:
        raise HTTPException(status_code=404, detail="project has no workspace path")
    root = Path(repo_path).resolve()
    if not root.exists():
        root.mkdir(parents=True, exist_ok=True)
    return root


def resolve_project_file(project: dict, rel_path: str) -> Path:
    root = project_root(project)
    rel = rel_path.lstrip("/").replace("\\", "/")
    if not rel or rel.startswith("..") or "/../" in f"/{rel}/":
        raise HTTPException(status_code=400, detail="invalid path")
    target = (root / rel).resolve()
    if root not in target.parents and target != root:
        raise HTTPException(status_code=400, detail="invalid path")
    return target


def walk_project_files(root: Path, *, depth: int = 0) -> list[str]:
    if depth > 8:
        return []
    out: list[str] = []
    try:
        for entry in sorted(root.iterdir()):
            if entry.name in _SKIP or entry.name.startswith("."):
                continue
            try:
                if entry.is_dir():
                    out.extend(walk_project_files(entry, depth=depth + 1))
                else:
                    out.append(str(entry.relative_to(root)))
            except (PermissionError, OSError):
                pass
    except (PermissionError, OSError):
        pass
    return out
