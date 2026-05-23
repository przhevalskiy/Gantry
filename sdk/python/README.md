# monolift

Python SDK for [Monolift](https://monolift.dev) — submit engineering tasks, get PRs back.

## Install

```bash
pip install monolift
```

## Quickstart

```python
from gantry import GantryClient

client = GantryClient(api_key="gantry_...")  # or set GANTRY_API_KEY env var

# List projects
projects = client.projects.list()

# Submit a task and wait for the PR
task = client.tasks.submit(
    "Add rate limiting to the /v1/tasks endpoint",
    project_id=projects[0].id,
)
task = client.tasks.wait(task.task_id, timeout=1800)

if task.succeeded:
    print(f"PR: {task.pr_url}")
else:
    print(f"Failed with status: {task.status}")
```

## CI / GitHub Actions

```yaml
- name: Submit Monolift task
  env:
    GANTRY_API_KEY: ${{ secrets.GANTRY_API_KEY }}
  run: |
    python - <<'EOF'
    from gantry import GantryClient
    client = GantryClient()
    task = client.tasks.submit("${{ github.event.issue.title }}", project_id="proj_abc")
    task = client.tasks.wait(task.task_id)
    print(task.pr_url)
    EOF
```

## Reference

### `GantryClient(api_key, base_url, timeout)`

| Param | Default |
|---|---|
| `api_key` | `GANTRY_API_KEY` env var |
| `base_url` | `https://api.monolift.dev` |
| `timeout` | `30.0` |

### `client.tasks`

| Method | Returns |
|---|---|
| `submit(goal, project_id, *, branch_prefix, tier, github_token, webhook_url)` | `Task` |
| `get(task_id)` | `Task` |
| `wait(task_id, *, timeout, poll_interval)` | `Task` |
| `messages(task_id)` | `list[dict]` |
| `terminate(task_id)` | `None` |
| `approve(task_id)` | `None` |

### `client.projects`

| Method | Returns |
|---|---|
| `list()` | `list[Project]` |
| `get(project_id)` | `Project` |
| `create(name, *, github_url)` | `Project` |
| `update(project_id, *, name, github_url)` | `Project` |
