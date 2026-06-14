"""GitHub repository creation and project registry activities."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from temporalio import activity

from activities._shared import _run, logger


@activity.defn(name="swarm_github_create_repo")
async def swarm_github_create_repo(
    repo_name: str,
    github_token: str,
    private: bool = True,
    description: str = "",
) -> str:
    """Create a new GitHub repository via the gh CLI. Returns JSON: {ok, github_url, message}."""
    safe_name = re.sub(r"[^a-z0-9-]", "-", repo_name.lower()).strip("-") or "gantry-project"
    visibility = "--private" if private else "--public"
    desc_flag = f'--description "{description}"' if description else ""
    env = {**os.environ, "GH_TOKEN": github_token}
    result = _run(f"gh repo create {safe_name} {visibility} {desc_flag}", env=env, timeout=30)
    if result["returncode"] != 0:
        return json.dumps({"ok": False, "github_url": "", "message": result["stderr"][:300]})
    url_match = re.search(r"https://github\.com/\S+", result["stdout"])
    github_url = url_match.group(0).rstrip("/") if url_match else result["stdout"].strip()
    return json.dumps({"ok": True, "github_url": github_url, "message": f"Created: {github_url}"})


@activity.defn(name="swarm_update_project_registry")
async def swarm_update_project_registry(project_id: str, github_url: str) -> str:
    """
    Update a project's github_url in the registry.

    Strategy: call the Next.js API first (single authoritative writer).
    Falls back to a direct locked file write if the UI is unreachable.
    """
    import fcntl
    import httpx
    from project.config import GANTRY_UI_URL

    # ── Primary: Next.js API ──────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.patch(
                f"{GANTRY_UI_URL}/api/projects",
                json={"id": project_id, "github_url": github_url},
            )
            if resp.status_code == 200:
                return f"Registry updated via API: {project_id} → {github_url}"
    except Exception:
        pass

    # ── Fallback: direct file write with exclusive lock ───────────────────────
    registry_path = (
        Path(os.getenv("GANTRY_FILES_BASE", str(Path.home() / ".gantry" / "projects")))
        / "registry.json"
    )
    if not registry_path.exists():
        return f"Registry not found: {registry_path}"
    lock_path = registry_path.with_suffix(".lock")
    try:
        with open(lock_path, "w") as lock_f:
            fcntl.flock(lock_f, fcntl.LOCK_EX)
            projects = json.loads(registry_path.read_text())
            for p in projects:
                if p.get("id") == project_id:
                    p["github_url"] = github_url
                    m = re.match(r"https://github\.com/([^/]+)/([^/]+?)(?:\.git)?$", github_url)
                    if m:
                        p["github_owner"] = m.group(1)
                        p["github_repo"] = m.group(2)
                    registry_path.write_text(json.dumps(projects, indent=2))
                    return f"Registry updated via file fallback: {project_id} → {github_url}"
            return f"Project {project_id} not found in registry"
    except Exception as e:
        return f"Registry update failed: {e}"
