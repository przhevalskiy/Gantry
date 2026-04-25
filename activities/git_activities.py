"""Git and GitHub PR activities."""
from __future__ import annotations

import json
import re
from pathlib import Path

from temporalio import activity

from activities._shared import _run, logger


@activity.defn(name="swarm_git_status")
async def swarm_git_status(cwd: str | None = None) -> str:
    return _run("git status --short", cwd=cwd)["stdout"] or "Working tree clean."


@activity.defn(name="swarm_git_create_branch")
async def swarm_git_create_branch(branch_name: str, cwd: str | None = None) -> str:
    result = _run(f"git checkout -b {branch_name}", cwd=cwd)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    return f"Created and checked out branch: {branch_name}"


@activity.defn(name="swarm_git_add")
async def swarm_git_add(paths: list[str], cwd: str | None = None) -> str:
    joined = " ".join(f'"{p}"' for p in paths)
    result = _run(f"git add {joined}", cwd=cwd)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    return f"Staged: {', '.join(paths)}"


@activity.defn(name="swarm_git_commit")
async def swarm_git_commit(message: str, cwd: str | None = None) -> str:
    result = _run(f'git commit -m "{message}"', cwd=cwd)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    sha_match = re.search(r"\[[\w/]+ ([a-f0-9]+)\]", result["stdout"])
    sha = sha_match.group(1) if sha_match else "unknown"
    return json.dumps({"sha": sha, "output": result["stdout"]})


@activity.defn(name="swarm_git_push")
async def swarm_git_push(branch_name: str, cwd: str | None = None) -> str:
    result = _run(f"git push -u origin {branch_name}", cwd=cwd)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    return result["stdout"] or f"Pushed branch: {branch_name}"


@activity.defn(name="swarm_create_pull_request")
async def swarm_create_pull_request(
    title: str,
    body: str,
    head_branch: str,
    base_branch: str = "main",
    cwd: str | None = None,
) -> str:
    """Create a PR using the GitHub CLI (gh). Falls back to a URL stub if gh is unavailable."""
    result = _run(
        f'gh pr create --title "{title}" --body "{body}" --base {base_branch} --head {head_branch}',
        cwd=cwd,
    )
    if result["returncode"] != 0:
        return json.dumps({
            "pr_url": f"(gh CLI unavailable — push {head_branch} and open PR manually)",
            "error": result["stderr"],
        })
    url_match = re.search(r"https://github\.com/\S+", result["stdout"])
    pr_url = url_match.group(0) if url_match else result["stdout"].strip()
    return json.dumps({"pr_url": pr_url})


@activity.defn(name="swarm_git_diff")
async def swarm_git_diff(
    cwd: str | None = None,
    staged: bool = False,
    paths: list[str] | None = None,
) -> str:
    """Show git diff vs HEAD (or staged changes)."""
    flag = "--cached" if staged else "HEAD"
    path_args = " ".join(f'"{p}"' for p in (paths or []))
    cmd = f"git diff {flag}" + (f" -- {path_args}" if path_args else "")
    result = _run(cmd, cwd=cwd, timeout=30)
    output = result["stdout"] or "(no changes)"
    if len(output) > 8000:
        output = output[:8000] + "\n\n[diff truncated — use paths= to narrow]"
    return output


@activity.defn(name="swarm_git_snapshot_save")
async def swarm_git_snapshot_save(repo_path: str, snapshot_ref: str) -> str:
    """Save a lightweight git snapshot before a build cycle via stash or HEAD SHA."""
    check = _run("git rev-parse --git-dir", cwd=repo_path, timeout=5)
    if check["returncode"] != 0:
        return json.dumps({"ok": False, "reason": "not a git repo", "ref": snapshot_ref})

    stash_result = _run(
        f'git stash push -u -m "swarm-snapshot-{snapshot_ref}"',
        cwd=repo_path, timeout=15,
    )
    if stash_result["returncode"] == 0 and "No local changes" not in stash_result["stdout"]:
        return json.dumps({"ok": True, "method": "stash", "ref": snapshot_ref})

    head = _run("git rev-parse HEAD", cwd=repo_path, timeout=5)
    sha = head["stdout"].strip() if head["returncode"] == 0 else ""
    if sha:
        return json.dumps({"ok": True, "method": "head_sha", "ref": sha})

    return json.dumps({"ok": False, "reason": "clean tree, nothing to snapshot", "ref": snapshot_ref})


@activity.defn(name="swarm_git_snapshot_restore")
async def swarm_git_snapshot_restore(repo_path: str, snapshot_json: str) -> str:
    """Restore a previously saved git snapshot."""
    try:
        snap = json.loads(snapshot_json)
    except Exception:
        return "Error: invalid snapshot JSON."

    if not snap.get("ok"):
        return f"Snapshot was not saved ({snap.get('reason', 'unknown')}), nothing to restore."

    method = snap.get("method")
    ref = snap.get("ref", "")

    if method == "stash":
        list_result = _run("git stash list", cwd=repo_path, timeout=10)
        stash_idx = None
        for line in (list_result["stdout"] or "").splitlines():
            if f"swarm-snapshot-{ref}" in line:
                stash_idx = line.split(":")[0]
                break
        if stash_idx is None:
            return f"Stash entry for snapshot '{ref}' not found — may have already been applied."
        _run("git checkout -- .", cwd=repo_path, timeout=10)
        pop = _run(f"git stash pop {stash_idx}", cwd=repo_path, timeout=15)
        if pop["returncode"] != 0:
            return f"Stash restore failed: {pop['stderr'][:300]}"
        return f"Restored snapshot '{ref}' from stash."

    if method == "head_sha":
        reset = _run(f"git reset --hard {ref}", cwd=repo_path, timeout=15)
        if reset["returncode"] != 0:
            return f"Reset to {ref} failed: {reset['stderr'][:300]}"
        return f"Restored to HEAD SHA {ref[:8]}."

    return f"Unknown snapshot method '{method}'."


@activity.defn(name="swarm_git_clone")
async def swarm_git_clone(
    github_url: str,
    dest_path: str,
    github_token: str | None = None,
) -> str:
    """Clone a GitHub repository to dest_path. Injects token for auth if provided."""
    import shutil

    dest = Path(dest_path)

    if (dest / ".git").exists():
        pull = _run("git fetch origin && git reset --hard origin/HEAD", cwd=dest_path, timeout=120)
        if pull["returncode"] == 0:
            return json.dumps({"ok": True, "path": dest_path, "message": "Repo already exists — reset to origin/HEAD."})

    if dest.exists():
        try:
            shutil.rmtree(dest_path)
        except Exception as e:
            return json.dumps({"ok": False, "path": dest_path, "message": f"Failed to remove stale directory: {e}"})

    dest.parent.mkdir(parents=True, exist_ok=True)

    clone_url = github_url
    if github_token and github_url.startswith("https://"):
        clone_url = github_url.replace("https://", f"https://{github_token}@", 1)

    result = _run(f'git clone --depth=50 "{clone_url}" "{dest_path}"', timeout=300)

    if result["returncode"] != 0:
        err = result["stderr"].replace(github_token or "", "***") if github_token else result["stderr"]
        return json.dumps({"ok": False, "path": dest_path, "message": f"Clone failed: {err[:400]}"})

    return json.dumps({"ok": True, "path": dest_path, "message": f"Cloned {github_url} → {dest_path}"})


@activity.defn(name="swarm_git_configure_remote")
async def swarm_git_configure_remote(
    repo_path: str,
    github_token: str,
    github_url: str,
) -> str:
    """Configure the git remote to use token-authenticated HTTPS."""
    auth_url = (
        github_url.replace("https://", f"https://{github_token}@", 1)
        if github_url.startswith("https://")
        else github_url
    )
    result = _run(f'git remote set-url origin "{auth_url}"', cwd=repo_path, timeout=15)
    if result["returncode"] != 0:
        return f"Error configuring remote: {result['stderr'][:200]}"

    _run('git config user.email "swarm@gantry.local"', cwd=repo_path, timeout=5)
    _run('git config user.name "Gantry Swarm"', cwd=repo_path, timeout=5)

    return "Remote configured with token auth."
