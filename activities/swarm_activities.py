"""
Swarm activities — file I/O, shell execution, and git operations.
All activities are deterministic wrappers; LLM calls live in planner activities.
"""
from __future__ import annotations

import asyncio
import fnmatch
import json
import os
import re
import signal as _signal
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

import structlog
from temporalio import activity

logger = structlog.get_logger(__name__)

# ── Helpers ──────────────────────────────────────────────────────────────────

def _run(cmd: str, cwd: str | None = None, timeout: int = 120) -> dict:
    """Run a shell command and return {stdout, stderr, returncode}."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            cwd=cwd or ".",
            timeout=timeout,
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


# ── File activities ───────────────────────────────────────────────────────────

@activity.defn(name="swarm_list_directory")
async def swarm_list_directory(path: str, max_depth: int = 2) -> str:
    """Return a tree-style directory listing."""
    base = Path(path)
    if not base.exists():
        return f"Error: path '{path}' does not exist."

    lines: list[str] = []

    def _walk(p: Path, depth: int, prefix: str = "") -> None:
        if depth > max_depth:
            return
        try:
            entries = sorted(p.iterdir(), key=lambda e: (e.is_file(), e.name))
        except PermissionError:
            return
        for i, entry in enumerate(entries):
            connector = "└── " if i == len(entries) - 1 else "├── "
            lines.append(f"{prefix}{connector}{entry.name}{'/' if entry.is_dir() else ''}")
            if entry.is_dir() and not entry.name.startswith("."):
                extension = "    " if i == len(entries) - 1 else "│   "
                _walk(entry, depth + 1, prefix + extension)

    lines.append(str(base))
    _walk(base, 1)
    return "\n".join(lines)


@activity.defn(name="swarm_read_file")
async def swarm_read_file(path: str) -> str:
    """Read a file and return its contents."""
    try:
        content = Path(path).read_text(encoding="utf-8", errors="replace")
        if len(content) <= 8000:
            return content
        return (
            content[:8000]
            + f"\n\n[TRUNCATED: showing first 8000 of {len(content)} characters. "
              "Request a narrower file section if more context is needed.]"
        )
    except FileNotFoundError:
        return f"Error: file '{path}' not found."
    except Exception as e:
        return f"Error reading '{path}': {e}"


@activity.defn(name="swarm_write_file")
async def swarm_write_file(path: str, content: str) -> str:
    """Write (create or overwrite) a file."""
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Written: {path} ({len(content)} chars)"
    except Exception as e:
        return f"Error writing '{path}': {e}"


@activity.defn(name="swarm_patch_file")
async def swarm_patch_file(path: str, old_str: str, new_str: str) -> str:
    """Apply a targeted string replacement to a file."""
    try:
        p = Path(path)
        original = p.read_text(encoding="utf-8")
        if old_str not in original:
            return f"Error: old_str not found in '{path}'. No changes made."
        patched = original.replace(old_str, new_str, 1)
        p.write_text(patched, encoding="utf-8")
        return f"Patched: {path}"
    except FileNotFoundError:
        return f"Error: file '{path}' not found."
    except Exception as e:
        return f"Error patching '{path}': {e}"


@activity.defn(name="swarm_delete_file")
async def swarm_delete_file(path: str) -> str:
    """Delete a file."""
    try:
        Path(path).unlink()
        return f"Deleted: {path}"
    except FileNotFoundError:
        return f"Error: file '{path}' not found."
    except Exception as e:
        return f"Error deleting '{path}': {e}"


# ── Shell activity ────────────────────────────────────────────────────────────

# Commands the Builder must never run — installs and builds block for minutes
# and are not the Builder's responsibility.
_BLOCKED_COMMAND_PATTERNS = [
    r"\bnpm\s+(install|ci|build|run\s+build)\b",
    r"\byarn\s+(install|build|run\s+build)\b",
    r"\bpnpm\s+(install|build)\b",
    r"\bpip\s+install\b",
    r"\buv\s+(sync|install)\b",
    r"\bvite\s+build\b",
    r"\btsc\b",
    r"\bnext\s+build\b",
    r"\bwebpack\b",
]
_BLOCKED_RE = re.compile("|".join(_BLOCKED_COMMAND_PATTERNS), re.IGNORECASE)


@activity.defn(name="swarm_run_command")
async def swarm_run_command(command: str, cwd: str | None = None, timeout: int = 120) -> str:
    """Run a shell command and return combined output."""
    # Hard-block install/build commands — these are not the Builder's job
    if _BLOCKED_RE.search(command):
        return (
            f"BLOCKED: '{command}' is not allowed in the Builder. "
            "Do not run package installs or build commands. "
            "Write source files only and call finish_build."
        )
    result = _run(command, cwd=cwd, timeout=timeout)
    output = result["stdout"]
    if result["stderr"]:
        output += f"\n[stderr]\n{result['stderr']}"
    if result["returncode"] != 0:
        output += f"\n[exit code: {result['returncode']}]"
    return output.strip() or "(no output)"


# ── Security scan activities ──────────────────────────────────────────────────

_SECRET_PATTERNS = [
    (r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"]?([A-Za-z0-9_\-]{20,})", "API Key"),
    (r"(?i)(secret[_-]?key|secret)\s*[:=]\s*['\"]?([A-Za-z0-9_\-]{20,})", "Secret Key"),
    (r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"]?([^\s'\"]{8,})", "Password"),
    (r"(?i)(token)\s*[:=]\s*['\"]?([A-Za-z0-9_\-\.]{20,})", "Token"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key"),
    (r"(?i)-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----", "Private Key"),
]

_SKIP_DIRS = {".git", ".venv", "node_modules", "__pycache__", ".pytest_cache"}
_SKIP_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".ttf", ".lock"}


@activity.defn(name="swarm_scan_secrets")
async def swarm_scan_secrets(path: str = ".") -> str:
    """Scan for accidentally committed secrets using regex patterns."""
    findings: list[str] = []
    base = Path(path)

    for file_path in base.rglob("*"):
        if not file_path.is_file():
            continue
        if any(part in _SKIP_DIRS for part in file_path.parts):
            continue
        if file_path.suffix.lower() in _SKIP_EXTS:
            continue
        # Skip .env files (expected to have secrets, but flag them)
        if file_path.name in (".env", ".env.local", ".env.production"):
            findings.append(f"WARNING: {file_path} — .env file present (ensure it's in .gitignore)")
            continue
        try:
            text = file_path.read_text(encoding="utf-8", errors="ignore")
            for pattern, label in _SECRET_PATTERNS:
                for match in re.finditer(pattern, text):
                    line_no = text[: match.start()].count("\n") + 1
                    findings.append(f"CRITICAL: {file_path}:{line_no} — {label} detected")
        except Exception:
            continue

    if not findings:
        return "No secrets detected."
    return "\n".join(findings)


# ── Git activities ────────────────────────────────────────────────────────────

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
    # Extract commit SHA from output
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
        # gh not available — return a stub
        return json.dumps({
            "pr_url": f"(gh CLI unavailable — push {head_branch} and open PR manually)",
            "error": result["stderr"],
        })
    url_match = re.search(r"https://github\.com/\S+", result["stdout"])
    pr_url = url_match.group(0) if url_match else result["stdout"].strip()
    return json.dumps({"pr_url": pr_url})


@activity.defn(name="swarm_find_test_files")
async def swarm_find_test_files(repo_path: str) -> list[str]:
    """Walk the repo and return relative paths of existing test files."""
    SKIP = {".git", "node_modules", "__pycache__", ".venv", ".next", "dist", "build", "coverage"}
    TEST_PATTERNS = re.compile(
        r"(^test_|_test\.|\.test\.|\.spec\.|/tests?/|/__tests__/)",
        re.IGNORECASE,
    )
    found: list[str] = []
    root = Path(repo_path)
    if not root.exists():
        return []
    for path in root.rglob("*"):
        if any(part in SKIP for part in path.parts):
            continue
        if path.is_file() and TEST_PATTERNS.search(str(path)):
            try:
                found.append(str(path.relative_to(root)))
            except ValueError:
                pass
    return sorted(found)


# ── New toolset activities ────────────────────────────────────────────────────

_SEARCH_SKIP = {".git", "node_modules", "__pycache__", ".venv", ".next", "dist", "build", "coverage"}
_BINARY_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".ttf", ".lock", ".bin", ".pyc", ".so", ".dll"}


@activity.defn(name="swarm_search_filesystem")
async def swarm_search_filesystem(
    pattern: str,
    path: str = ".",
    search_type: str = "name",
) -> str:
    """Search for files by name (glob) or content (regex). Returns matching paths or lines."""
    base = Path(path)
    if not base.exists():
        return f"Error: path '{path}' does not exist."

    found: list[str] = []

    if search_type == "name":
        for p in sorted(base.rglob("*")):
            if any(part in _SEARCH_SKIP for part in p.parts):
                continue
            if p.is_file() and fnmatch.fnmatch(p.name, pattern):
                found.append(str(p))
    elif search_type == "content":
        try:
            content_re = re.compile(pattern)
        except re.error as e:
            return f"Error: invalid regex pattern '{pattern}': {e}"
        for p in sorted(base.rglob("*")):
            if any(part in _SEARCH_SKIP for part in p.parts):
                continue
            if not p.is_file() or p.suffix.lower() in _BINARY_EXTS:
                continue
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
                lines = text.splitlines()
                for i, line in enumerate(lines):
                    if content_re.search(line):
                        found.append(f"{p}:{i+1}: {line.strip()}")
                        if len(found) >= 100:
                            break
            except Exception:
                continue
            if len(found) >= 100:
                break
    else:
        return f"Error: unknown search_type '{search_type}'. Use 'name' or 'content'."

    if not found:
        return f"No results for pattern '{pattern}' in '{path}'."
    if len(found) > 50:
        found = found[:50]
        found.append("… (showing first 50 results — narrow your search)")
    return "\n".join(found)


@activity.defn(name="swarm_str_replace_editor")
async def swarm_str_replace_editor(
    command: str,
    path: str,
    old_str: str = "",
    new_str: str = "",
    view_range: list[int] | None = None,
) -> str:
    """View a file with line numbers, perform a str_replace edit, or create a new file."""
    p = Path(path)

    if command == "view":
        if not p.exists():
            return f"Error: file '{path}' not found."
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
            start = (view_range[0] - 1) if view_range else 0
            end = view_range[1] if view_range else len(lines)
            start = max(0, start)
            end = min(end, len(lines))
            numbered = "\n".join(f"{i + start + 1:4d} | {l}" for i, l in enumerate(lines[start:end]))
            return f"File: {path} (lines {start+1}–{end} of {len(lines)})\n{numbered}"
        except Exception as e:
            return f"Error reading '{path}': {e}"

    if command == "str_replace":
        if not p.exists():
            return f"Error: file '{path}' not found."
        try:
            original = p.read_text(encoding="utf-8")
            if old_str not in original:
                preview = "\n".join(
                    f"{i+1:4d} | {l}"
                    for i, l in enumerate(original.splitlines()[:40])
                )
                return (
                    f"Error: old_str not found in '{path}'. No changes made.\n"
                    f"First 40 lines of file:\n{preview}"
                )
            count = original.count(old_str)
            if count > 1:
                return (
                    f"Error: old_str appears {count} times in '{path}'. "
                    "Make it more specific to avoid ambiguous replacement."
                )
            p.write_text(original.replace(old_str, new_str, 1), encoding="utf-8")
            return f"Replaced in {path}."
        except Exception as e:
            return f"Error editing '{path}': {e}"

    if command == "create":
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(new_str, encoding="utf-8")
            return f"Created: {path} ({len(new_str)} chars)"
        except Exception as e:
            return f"Error creating '{path}': {e}"

    return f"Error: unknown command '{command}'. Use 'view', 'str_replace', or 'create'."


@activity.defn(name="swarm_install_packages")
async def swarm_install_packages(
    manager: str,
    packages: list[str] | None = None,
    flags: str = "",
    cwd: str | None = None,
) -> str:
    """Install packages with npm, yarn, pnpm, pip, pip3, or uv."""
    ALLOWED = {"npm", "yarn", "pnpm", "pip", "pip3", "uv"}
    if manager not in ALLOWED:
        return f"Error: unknown manager '{manager}'. Allowed: {', '.join(sorted(ALLOWED))}"

    pkgs = packages or []
    if pkgs:
        pkg_str = " ".join(pkgs)
        flag_str = f" {flags}" if flags else ""
        cmd_map = {
            "npm": f"npm install{flag_str} {pkg_str}",
            "yarn": f"yarn add{flag_str} {pkg_str}",
            "pnpm": f"pnpm add{flag_str} {pkg_str}",
            "pip": f"pip install{flag_str} {pkg_str}",
            "pip3": f"pip3 install{flag_str} {pkg_str}",
            "uv": f"uv add{flag_str} {pkg_str}",
        }
    else:
        cmd_map = {
            "npm": "npm install",
            "yarn": "yarn install",
            "pnpm": "pnpm install",
            "pip": "pip install -r requirements.txt",
            "pip3": "pip3 install -r requirements.txt",
            "uv": "uv sync",
        }

    result = _run(cmd_map[manager], cwd=cwd, timeout=300)
    output = result["stdout"]
    if result["stderr"]:
        output += f"\n[stderr]\n{result['stderr']}"
    if result["returncode"] != 0:
        output += f"\n[exit code: {result['returncode']}]"
    return output.strip() or "(no output)"


@activity.defn(name="swarm_run_application_feedback")
async def swarm_run_application_feedback(
    start_command: str,
    url: str = "http://localhost:3000",
    wait_seconds: int = 5,
    cwd: str | None = None,
) -> str:
    """Start an app, wait for startup, probe a URL, return HTTP status + body excerpt."""
    try:
        proc = subprocess.Popen(
            start_command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=cwd or ".",
            text=True,
            preexec_fn=os.setsid,
        )
    except Exception as e:
        return f"Error starting application: {e}"

    try:
        await asyncio.sleep(max(1, wait_seconds))

        probe = _run(
            f"curl -s -o /dev/null -w '%{{http_code}}|%{{time_total}}' --max-time 10 '{url}'",
            timeout=15,
        )
        body_result = _run(f"curl -s --max-time 10 '{url}'", timeout=15)
        body = (body_result["stdout"] or "")[:2000]

        parts = (probe["stdout"] or "0|0").split("|")
        http_code = parts[0]
        time_total = parts[1] if len(parts) > 1 else "?"

        lines = [
            f"Command: {start_command}",
            f"URL: {url}",
            f"HTTP status: {http_code}",
            f"Response time: {time_total}s",
        ]
        if body:
            lines.append(f"Response body:\n{body}")
        if probe["returncode"] != 0:
            lines.append(f"Probe error: {probe['stderr']}")
        return "\n".join(lines)
    finally:
        try:
            os.killpg(os.getpgid(proc.pid), _signal.SIGTERM)
        except Exception:
            pass
        try:
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass


@activity.defn(name="swarm_check_secrets")
async def swarm_check_secrets(names: list[str]) -> str:
    """Check whether environment variables (secrets) are present in the worker environment."""
    results = {name: bool(os.environ.get(name)) for name in names}
    lines = [f"{'✓' if v else '✗'} {k}" for k, v in results.items()]
    missing = [k for k, v in results.items() if not v]
    if missing:
        lines.append(f"\nMissing: {', '.join(missing)}")
        lines.append("Set these in the environment before running the application.")
    else:
        lines.append("\nAll required secrets are present.")
    return "\n".join(lines)


# ── Web / network activities ──────────────────────────────────────────────────

@activity.defn(name="swarm_web_search")
async def swarm_web_search(query: str, num_results: int = 5) -> str:
    """Search the web. Uses Brave Search API if BRAVE_SEARCH_API_KEY is set, else DuckDuckGo."""
    num_results = min(num_results, 10)

    brave_key = os.environ.get("BRAVE_SEARCH_API_KEY")
    if brave_key:
        try:
            url = f"https://api.search.brave.com/res/v1/web/search?q={urllib.parse.quote(query)}&count={num_results}"
            req = urllib.request.Request(url, headers={
                "Accept": "application/json",
                "X-Subscription-Token": brave_key,
            })
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read())
            results = data.get("web", {}).get("results", [])
            if results:
                lines: list[str] = []
                for r in results[:num_results]:
                    lines.append(f"**{r.get('title', '')}**")
                    lines.append(r.get("url", ""))
                    if r.get("description"):
                        lines.append(r["description"])
                    lines.append("")
                return "\n".join(lines).strip()
        except Exception:
            pass  # fall through to DDG

    # Fallback: DuckDuckGo instant answer API (no key needed)
    try:
        ddg_url = (
            f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}"
            "&format=json&no_redirect=1&no_html=1&skip_disambig=1"
        )
        req = urllib.request.Request(ddg_url, headers={"User-Agent": "Keystone/1.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read())
        lines = []
        if data.get("AbstractText"):
            lines.append(data["AbstractText"])
            if data.get("AbstractURL"):
                lines.append(f"Source: {data['AbstractURL']}")
            lines.append("")
        for topic in data.get("RelatedTopics", [])[:num_results]:
            if isinstance(topic, dict) and topic.get("Text"):
                lines.append(f"- {topic['Text']}")
                if topic.get("FirstURL"):
                    lines.append(f"  {topic['FirstURL']}")
        if lines:
            lines.append("\nTip: Set BRAVE_SEARCH_API_KEY for full web search results.")
            return "\n".join(lines).strip()
        return (
            f"No instant-answer results for '{query}'.\n"
            "Set BRAVE_SEARCH_API_KEY in the worker environment for full web search."
        )
    except Exception as e:
        return (
            f"Web search unavailable: {e}\n"
            "Set BRAVE_SEARCH_API_KEY in the worker environment to enable web search."
        )


@activity.defn(name="swarm_fetch_url")
async def swarm_fetch_url(url: str, max_chars: int = 8000) -> str:
    """Fetch a URL and return its text content with HTML stripped."""
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; Keystone/1.0)",
            "Accept": "text/html,text/plain,application/xhtml+xml,*/*",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("content-type", "")
            raw = resp.read(max_chars * 4)  # read a bit extra before stripping
        text = raw.decode("utf-8", errors="replace")
        if "html" in content_type.lower() or text.lstrip().startswith("<"):
            text = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", "", text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"[ \t]{2,}", " ", text)
            text = re.sub(r"\n{3,}", "\n\n", text.strip())
        if len(text) > max_chars:
            text = text[:max_chars] + f"\n\n[truncated — showing {max_chars} of {len(text)} chars]"
        return text.strip() or "(empty response)"
    except Exception as e:
        return f"Error fetching '{url}': {e}"


# ── SQL activity ──────────────────────────────────────────────────────────────

@activity.defn(name="swarm_execute_sql")
async def swarm_execute_sql(query: str, database_url: str | None = None, cwd: str | None = None) -> str:
    """Execute SQL against the project database via CLI (psql, sqlite3, mysql)."""
    db_url = database_url or os.environ.get("DATABASE_URL", "")
    if not db_url:
        return (
            "Error: no database URL provided. "
            "Pass database_url or set DATABASE_URL in the environment."
        )
    # Escape double-quotes inside the query for shell safety
    safe_q = query.replace("\\", "\\\\").replace('"', '\\"')
    if db_url.startswith(("postgresql://", "postgres://")):
        result = _run(f'psql "{db_url}" -c "{safe_q}"', cwd=cwd, timeout=30)
    elif db_url.startswith("sqlite:") or db_url.endswith((".db", ".sqlite", ".sqlite3")):
        db_path = re.sub(r"^sqlite:///", "", db_url)
        result = _run(f'sqlite3 "{db_path}" "{safe_q}"', cwd=cwd, timeout=30)
    elif db_url.startswith("mysql://"):
        parsed = urllib.parse.urlparse(db_url)
        db_name = parsed.path.lstrip("/")
        pw_flag = f"-p{parsed.password}" if parsed.password else ""
        result = _run(
            f'mysql -u {parsed.username} {pw_flag} -h {parsed.hostname} {db_name} -e "{safe_q}"',
            cwd=cwd, timeout=30,
        )
    else:
        return f"Unsupported database URL scheme: {db_url[:30]}…"

    output = result["stdout"]
    if result["stderr"]:
        output += f"\n[stderr]\n{result['stderr']}"
    if result["returncode"] != 0:
        output += f"\n[exit code: {result['returncode']}]"
    return output.strip() or "(no output)"


# ── Git diff activity ─────────────────────────────────────────────────────────

@activity.defn(name="swarm_git_diff")
async def swarm_git_diff(
    cwd: str | None = None,
    staged: bool = False,
    paths: list[str] | None = None,
) -> str:
    """Show git diff vs HEAD (or staged changes). Use for self-review before committing."""
    flag = "--cached" if staged else "HEAD"
    path_args = " ".join(f'"{p}"' for p in (paths or []))
    cmd = f"git diff {flag}" + (f" -- {path_args}" if path_args else "")
    result = _run(cmd, cwd=cwd, timeout=30)
    output = result["stdout"] or "(no changes)"
    if len(output) > 8000:
        output = output[:8000] + "\n\n[diff truncated — use paths= to narrow]"
    return output


# ── Migration activity ────────────────────────────────────────────────────────

@activity.defn(name="swarm_run_migration")
async def swarm_run_migration(
    tool: str = "auto",
    cwd: str | None = None,
    command: str | None = None,
) -> str:
    """Run database migrations. Auto-detects alembic, prisma, knex, rails, or flyway."""
    work_dir = cwd or "."
    base = Path(work_dir)

    if not tool or tool == "auto":
        if (base / "alembic.ini").exists():
            tool = "alembic"
        elif (base / "prisma" / "schema.prisma").exists():
            tool = "prisma"
        elif (base / "knexfile.js").exists() or (base / "knexfile.ts").exists():
            tool = "knex"
        elif (base / "Gemfile").exists():
            tool = "rails"
        elif list(base.glob("V*__*.sql")):
            tool = "flyway"
        else:
            return (
                "Could not detect migration tool. "
                "No alembic.ini, prisma/schema.prisma, knexfile.js, or Gemfile found. "
                "Pass tool= explicitly."
            )

    cmd_map = {
        "alembic": f"alembic {command or 'upgrade head'}",
        "prisma":  f"npx prisma {command or 'migrate deploy'}",
        "knex":    f"npx knex {command or 'migrate:latest'}",
        "rails":   f"bundle exec rake {command or 'db:migrate'}",
        "flyway":  f"flyway {command or 'migrate'}",
    }
    if tool not in cmd_map:
        return f"Unsupported tool '{tool}'. Choose from: {', '.join(cmd_map)}"

    result = _run(cmd_map[tool], cwd=work_dir, timeout=120)
    output = result["stdout"]
    if result["stderr"]:
        output += f"\n[stderr]\n{result['stderr']}"
    if result["returncode"] != 0:
        output += f"\n[exit code: {result['returncode']}]"
    return output.strip() or "(no output)"


# ── Port inspection activity ──────────────────────────────────────────────────

@activity.defn(name="swarm_list_ports")
async def swarm_list_ports(ports: list[int] | None = None) -> str:
    """Check which TCP ports are in use. Pass specific ports or get all listening ports."""
    if ports:
        lines: list[str] = []
        for port in ports:
            result = _run(f"lsof -i :{port} -sTCP:LISTEN -n -P 2>/dev/null", timeout=10)
            if result["stdout"].strip():
                lines.append(f"Port {port}: IN USE\n{result['stdout'].strip()}")
            else:
                lines.append(f"Port {port}: free")
        return "\n".join(lines)
    result = _run("lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null", timeout=10)
    if not result["stdout"].strip():
        result = _run("ss -tlnp 2>/dev/null", timeout=10)  # Linux fallback
    return result["stdout"].strip() or "No listening ports found."


# ── Deploy activity ───────────────────────────────────────────────────────────

@activity.defn(name="swarm_deploy")
async def swarm_deploy(platform: str = "auto", cwd: str | None = None) -> str:
    """Deploy to Vercel, Railway, Fly.io, Netlify, or Heroku. Auto-detects from config + tokens."""
    work_dir = cwd or "."
    base = Path(work_dir)

    if not platform or platform == "auto":
        if os.environ.get("VERCEL_TOKEN") or (base / "vercel.json").exists() or (base / ".vercel").is_dir():
            platform = "vercel"
        elif os.environ.get("RAILWAY_TOKEN") or (base / "railway.json").exists():
            platform = "railway"
        elif os.environ.get("FLY_API_TOKEN") or (base / "fly.toml").exists():
            platform = "fly"
        elif os.environ.get("NETLIFY_AUTH_TOKEN") or (base / "netlify.toml").exists():
            platform = "netlify"
        elif os.environ.get("HEROKU_API_KEY") or (base / "Procfile").exists():
            platform = "heroku"
        else:
            return (
                "Could not detect deployment platform. "
                "Set one of: VERCEL_TOKEN, RAILWAY_TOKEN, FLY_API_TOKEN, "
                "NETLIFY_AUTH_TOKEN, HEROKU_API_KEY — or pass platform= explicitly."
            )

    cmd_map = {
        "vercel":  "vercel --prod --yes",
        "railway": "railway up",
        "fly":     "fly deploy",
        "netlify": "netlify deploy --prod",
        "heroku":  "git push heroku HEAD:main",
    }
    if platform not in cmd_map:
        return f"Unsupported platform '{platform}'. Choose from: {', '.join(cmd_map)}"

    result = _run(cmd_map[platform], cwd=work_dir, timeout=300)
    output = result["stdout"]
    if result["stderr"]:
        output += f"\n[stderr]\n{result['stderr']}"
    if result["returncode"] != 0:
        output += f"\n[exit code: {result['returncode']}]"
    return output.strip() or "(no output)"


# ── Agent memory activities ───────────────────────────────────────────────────
# These delegate to the shared .keystone/memory/facts.json layer so all agents
# read from the same store regardless of whether they call the old swarm_* names
# or the new memory_write_fact / memory_read_facts activities.

_MEMORY_DIR = ".keystone/memory"
_FACTS_FILE = "facts.json"


def _facts_path(repo_path: str):
    from datetime import datetime, timezone
    p = Path(repo_path) / _MEMORY_DIR
    p.mkdir(parents=True, exist_ok=True)
    return p / _FACTS_FILE


@activity.defn(name="swarm_memory_write")
async def swarm_memory_write(
    key: str,
    value: str,
    repo_path: str,
    agent: str = "unknown",
    confidence: float = 1.0,
) -> str:
    """Store a durable fact in the shared memory layer."""
    from datetime import datetime, timezone
    fp = _facts_path(repo_path)
    try:
        data: dict = json.loads(fp.read_text()) if fp.exists() else {}
    except Exception:
        data = {}
    data[key] = {
        "value": value,
        "agent": agent,
        "confidence": round(confidence, 2),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    fp.write_text(json.dumps(data, indent=2))
    return f"Fact '{key}' stored by {agent}."


@activity.defn(name="swarm_memory_read")
async def swarm_memory_read(repo_path: str, keys: list[str] | None = None) -> str:
    """Read facts stored by any agent."""
    fp = _facts_path(repo_path)
    if not fp.exists():
        return "No facts stored yet."
    try:
        data: dict = json.loads(fp.read_text())
    except Exception:
        return "Error reading facts (malformed JSON)."
    subset = {k: data[k] for k in keys if k in data} if keys else data
    if not subset:
        return "No matching facts found." if keys else "Facts store is empty."
    lines = []
    for k, v in subset.items():
        if isinstance(v, dict):
            lines.append(f"**{k}** [{v.get('agent', '?')}]: {v.get('value', '')}")
        else:
            lines.append(f"**{k}**: {v}")
    return "\n".join(lines)
