#!/usr/bin/env python3
"""Create a demo hubspace and submit three factory runs for UI testing."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API = os.environ.get("GANTRY_API_URL", "http://127.0.0.1:8001").rstrip("/")

TASKS = [
    {
        "label": "Todo app + dev server",
        "goal": (
            "Build a minimal React todo app with Vite. "
            "Run npm run dev and log the localhost URL when the dev server starts."
        ),
        "tier": 1,
    },
    {
        "label": "Dark mode toggle",
        "goal": "Add a dark mode toggle to the todo app and persist the preference in localStorage.",
        "tier": 0,
    },
    {
        "label": "A11y remediation",
        "goal": (
            "Fix accessibility issues in the React todo app components "
            "(labels, contrast, keyboard focus)."
        ),
        "tier": 1,
        "playbook": "a11y-remediation",
    },
]


def req(method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{API}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(exc.read().decode()) from exc


def main() -> int:
    health = req("GET", "/health")
    if not health.get("ok"):
        print("Gantry API unhealthy:", health, file=sys.stderr)
        return 1

    projects = req("GET", "/v1/projects").get("projects", [])
    if projects:
        project = projects[0]
    else:
        project = req("POST", "/v1/projects", {"name": "UI Demo Hubspace"})["project"]

    project_id = project["id"]
    web = os.environ.get("GANTRY_WEB_URL", "http://localhost:5173").rstrip("/")

    print(f"Hubspace: {project['name']} ({project_id})")
    if project.get("repo_path"):
        print(f"Repo: {project['repo_path']}")
    print()

    created: list[tuple[str, str]] = []
    for spec in TASKS:
        body = {
            "goal": spec["goal"],
            "project_id": project_id,
            "tier": spec["tier"],
        }
        if spec.get("playbook"):
            body["playbook"] = spec["playbook"]
        try:
            out = req("POST", "/v1/tasks", body)
            task_id = out["task_id"]
            created.append((spec["label"], task_id))
            print(f"{spec['label']}")
            print(f"  task_id: {task_id}")
            print(f"  run:     {web}/runs/{task_id}")
            print(f"  status:  {out.get('status', 'queued')}")
            print()
        except RuntimeError as exc:
            print(f"{spec['label']}: FAILED")
            print(f"  {exc}")
            print()

    if not created:
        print("No tasks created. Ensure ./dev.sh is running (Agentex + swarm-factory agent).", file=sys.stderr)
        return 1

    print("Open the run URLs above to inspect Explorer, Preview, Crew, and Traces.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
