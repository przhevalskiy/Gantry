"""Security scanning activities."""
from __future__ import annotations

import re
from pathlib import Path

from temporalio import activity

from activities._shared import logger

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
