"""Shell execution, package management, and build verification activities."""
from __future__ import annotations

import asyncio
import json
import os
import re
import subprocess
import urllib.parse
from pathlib import Path

from temporalio import activity

from activities._shared import _run, logger

# Commands the Builder must never run
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

_VERIFY_SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", ".next", "dist", "build", "coverage"}


@activity.defn(name="swarm_run_command")
async def swarm_run_command(command: str, cwd: str | None = None, timeout: int = 120) -> str:
    """Run a shell command and return combined output."""
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
            os.killpg(os.getpgid(proc.pid), __import__("signal").SIGTERM)
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


@activity.defn(name="swarm_execute_sql")
async def swarm_execute_sql(query: str, database_url: str | None = None, cwd: str | None = None) -> str:
    """Execute SQL against the project database via CLI (psql, sqlite3, mysql)."""
    db_url = database_url or os.environ.get("DATABASE_URL", "")
    if not db_url:
        return (
            "Error: no database URL provided. "
            "Pass database_url or set DATABASE_URL in the environment."
        )
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


@activity.defn(name="swarm_list_ports")
async def swarm_list_ports(ports: list[int] | None = None) -> str:
    """Check which TCP ports are in use."""
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
        result = _run("ss -tlnp 2>/dev/null", timeout=10)
    return result["stdout"].strip() or "No listening ports found."


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


def _detect_verify_commands(repo_path: str) -> list[tuple[str, str]]:
    """Auto-detect verification commands (lint, type-check) for this repo."""
    base = Path(repo_path)
    commands: list[tuple[str, str]] = []

    if (base / "pyproject.toml").exists() or (base / "setup.py").exists():
        ruff = _run("ruff --version", cwd=repo_path, timeout=5)
        if ruff["returncode"] == 0:
            commands.append(("ruff", f"ruff check {repo_path} --select E,F,W --quiet"))
        else:
            flake8 = _run("flake8 --version", cwd=repo_path, timeout=5)
            if flake8["returncode"] == 0:
                commands.append(("flake8", f"flake8 {repo_path} --max-line-length=120 --count --quiet"))
        mypy = _run("mypy --version", cwd=repo_path, timeout=5)
        if mypy["returncode"] == 0:
            commands.append(("mypy", f"mypy {repo_path} --ignore-missing-imports --no-error-summary --quiet"))

    pkg_json = base / "package.json"
    if pkg_json.exists():
        try:
            pkg = json.loads(pkg_json.read_text())
            scripts = pkg.get("scripts", {})
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        except Exception:
            scripts, deps = {}, {}

        if (base / "tsconfig.json").exists() and "typescript" in deps:
            commands.append(("tsc", "npx tsc --noEmit"))

        eslint_cfg = any(
            (base / f).exists()
            for f in (".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.cjs", "eslint.config.js", "eslint.config.mjs")
        )
        if eslint_cfg and ("eslint" in deps or "lint" in scripts):
            lint_cmd = scripts.get("lint", "npx eslint . --max-warnings=0")
            commands.append(("eslint", lint_cmd))

    return commands


@activity.defn(name="swarm_verify_build")
async def swarm_verify_build(repo_path: str) -> dict:
    """
    Auto-detect and run lightweight verification checks (lint, type-check) on the repo.
    Returns {passed: bool, checks: [{label, passed, output}], summary: str}.
    """
    commands = _detect_verify_commands(repo_path)

    if not commands:
        return {
            "passed": True,
            "checks": [],
            "summary": "No verification tools detected (no pyproject.toml, tsconfig.json, or eslint config found).",
        }

    checks: list[dict] = []
    overall_passed = True

    for label, cmd in commands:
        result = _run(cmd, cwd=repo_path, timeout=60)
        passed = result["returncode"] == 0
        output = (result["stdout"] + "\n" + result["stderr"]).strip()
        if len(output) > 2000:
            output = output[:2000] + "\n[truncated]"
        checks.append({"label": label, "passed": passed, "output": output})
        if not passed:
            overall_passed = False

    passed_labels = [c["label"] for c in checks if c["passed"]]
    failed_labels = [c["label"] for c in checks if not c["passed"]]

    parts = []
    if passed_labels:
        parts.append(f"✓ {', '.join(passed_labels)}")
    if failed_labels:
        parts.append(f"✗ {', '.join(failed_labels)}")

    return {
        "passed": overall_passed,
        "checks": checks,
        "summary": " | ".join(parts) or "No checks ran.",
    }
