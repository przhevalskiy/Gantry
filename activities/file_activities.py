"""File I/O and filesystem search activities."""
from __future__ import annotations

import fnmatch
import re
from pathlib import Path

from temporalio import activity

from activities._shared import _acquire_write_lock, _release_write_lock, logger

_SEARCH_SKIP = {".git", "node_modules", "__pycache__", ".venv", ".next", "dist", "build", "coverage"}
_BINARY_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".ttf", ".lock", ".bin", ".pyc", ".so", ".dll"}


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
        info = activity.info()
        owner = info.activity_id or "unknown"
    except Exception:
        owner = "unknown"

    lock = await _acquire_write_lock(path, owner)
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Written: {path} ({len(content)} chars)"
    finally:
        _release_write_lock(path)


@activity.defn(name="swarm_patch_file")
async def swarm_patch_file(path: str, old_str: str, new_str: str) -> str:
    """Apply a targeted string replacement to a file."""
    try:
        info = activity.info()
        owner = info.activity_id or "unknown"
    except Exception:
        owner = "unknown"

    lock = await _acquire_write_lock(path, owner)
    try:
        p = Path(path)
        try:
            original = p.read_text(encoding="utf-8")
        except FileNotFoundError:
            return f"ERROR: file '{path}' not found — use write_file to create it first."
        if old_str not in original:
            preview = "\n".join(f"{i+1:4d} | {l}" for i, l in enumerate(original.splitlines()[:20]))
            return (
                f"ERROR: old_str not found in '{path}'. No changes made.\n"
                f"Use str_replace_editor to view the file, then retry with the exact string.\n"
                f"First 20 lines:\n{preview}"
            )
        count = original.count(old_str)
        if count > 1:
            return f"ERROR: old_str appears {count} times in '{path}'. Make it more specific."
        p.write_text(original.replace(old_str, new_str, 1), encoding="utf-8")
        return f"Patched: {path}"
    finally:
        _release_write_lock(path)


@activity.defn(name="swarm_delete_file")
async def swarm_delete_file(path: str) -> str:
    """Delete a file."""
    try:
        Path(path).unlink()
        return f"Deleted: {path}"
    except FileNotFoundError:
        return f"ERROR: file '{path}' not found — nothing to delete."
    except Exception as e:
        return f"ERROR: could not delete '{path}': {e}"


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

    try:
        info = activity.info()
        owner = info.activity_id or "unknown"
    except Exception:
        owner = "unknown"

    lock = await _acquire_write_lock(path, owner)
    try:
        if command == "str_replace":
            if not p.exists():
                return f"ERROR: file '{path}' not found — use 'create' command to create it first."
            original = p.read_text(encoding="utf-8")
            if old_str not in original:
                preview = "\n".join(
                    f"{i+1:4d} | {l}"
                    for i, l in enumerate(original.splitlines()[:60])
                )
                return (
                    f"ERROR: old_str not found in '{path}'. No changes made.\n"
                    f"STOP guessing — call str_replace_editor with command='view' on this file first, "
                    f"copy the exact lines from the output, then retry.\n"
                    f"Current file ({len(original.splitlines())} lines):\n{preview}"
                )
            count = original.count(old_str)
            if count > 1:
                return (
                    f"ERROR: old_str appears {count} times in '{path}'. "
                    "Make old_str longer and more specific to avoid ambiguous replacement."
                )
            p.write_text(original.replace(old_str, new_str, 1), encoding="utf-8")
            return f"Replaced in {path}."

        if command == "create":
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(new_str, encoding="utf-8")
            return f"Created: {path} ({len(new_str)} chars)"

        return f"Error: unknown command '{command}'. Use 'view', 'str_replace', or 'create'."
    finally:
        _release_write_lock(path)


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
                for i, line in enumerate(text.splitlines()):
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
