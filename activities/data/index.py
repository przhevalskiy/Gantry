"""Symbol search and repository index activities."""
from __future__ import annotations

import json
import re
from pathlib import Path

from temporalio import activity

from activities._shared import logger

_SYMBOL_SKIP = {".git", "node_modules", "__pycache__", ".venv", ".next", "dist", "build", "coverage"}

_SYMBOL_PATTERNS: list[tuple[frozenset[str], str, int]] = [
    (frozenset({".py"}),    r"^(?:async\s+)?def\s+(\w+)\s*\(",  1),
    (frozenset({".py"}),    r"^class\s+(\w+)\s*[:(]",           1),
    (frozenset({".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}),
     r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[\(<]",    1),
    (frozenset({".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}),
     r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(",  1),
    (frozenset({".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}),
     r"(?:export\s+)?class\s+(\w+)\s*(?:extends|implements|{)",  1),
    (frozenset({".ts", ".tsx"}),
     r"(?:export\s+)?(?:type|interface)\s+(\w+)\s*[={<]",        1),
    (frozenset({".go"}), r"^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(", 1),
    (frozenset({".go"}), r"^type\s+(\w+)\s+(?:struct|interface)",         1),
    (frozenset({".rs"}), r"^(?:pub\s+)?fn\s+(\w+)\s*[\(<]",    1),
    (frozenset({".rs"}), r"^(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)", 1),
]

_INDEX_FILE = ".gantry/index.json"
_INDEX_SKIP = {".git", "node_modules", "__pycache__", ".venv", ".next", "dist", "build", "coverage", ".gantry"}
_INDEX_BINARY_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".ttf", ".lock", ".bin", ".pyc", ".so", ".dll", ".map"}

_INDEX_PATTERNS: list[tuple[frozenset[str], str, int, str]] = [
    (frozenset({".py"}),    r"^(?:async\s+)?def\s+(\w+)\s*\(",  1, "function"),
    (frozenset({".py"}),    r"^class\s+(\w+)\s*[:(]",           1, "class"),
    (frozenset({".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}),
     r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[\(<]",    1, "function"),
    (frozenset({".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}),
     r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(",  1, "function"),
    (frozenset({".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}),
     r"(?:export\s+)?class\s+(\w+)\s*(?:extends|implements|{)",  1, "class"),
    (frozenset({".ts", ".tsx"}),
     r"(?:export\s+)?(?:type|interface)\s+(\w+)\s*[={<]",        1, "type"),
    (frozenset({".go"}), r"^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(", 1, "function"),
    (frozenset({".go"}), r"^type\s+(\w+)\s+(?:struct|interface)",         1, "type"),
    (frozenset({".rs"}), r"^(?:pub\s+)?fn\s+(\w+)\s*[\(<]",    1, "function"),
    (frozenset({".rs"}), r"^(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)", 1, "type"),
]


@activity.defn(name="swarm_find_symbol")
async def swarm_find_symbol(
    symbol: str,
    repo_path: str,
    exact: bool = False,
) -> str:
    """
    Find where a function, class, type, or interface is defined in the repo.
    Returns matching file paths, line numbers, and the matching line.
    """
    base = Path(repo_path)
    if not base.exists():
        return f"Error: repo_path '{repo_path}' does not exist."

    results: list[str] = []
    symbol_lower = symbol.lower()

    for file_path in sorted(base.rglob("*")):
        if not file_path.is_file():
            continue
        if any(part in _SYMBOL_SKIP for part in file_path.parts):
            continue
        ext = file_path.suffix.lower()

        applicable = [(pat, grp) for (exts, pat, grp) in _SYMBOL_PATTERNS if ext in exts]
        if not applicable:
            continue

        try:
            lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            for pat, grp in applicable:
                m = re.search(pat, line)
                if not m:
                    continue
                try:
                    name = m.group(grp)
                except IndexError:
                    continue
                if exact:
                    if name != symbol:
                        continue
                else:
                    if symbol_lower not in name.lower():
                        continue
                try:
                    rel = str(file_path.relative_to(base))
                except ValueError:
                    rel = str(file_path)
                results.append(f"{rel}:{lineno}: {line.strip()}")
                break

        if len(results) >= 50:
            results.append("… (showing first 50 results — use exact=true to narrow)")
            break

    if not results:
        return f"Symbol '{symbol}' not found in '{repo_path}'."
    return "\n".join(results)


@activity.defn(name="swarm_build_repo_index")
async def swarm_build_repo_index(repo_path: str) -> str:
    """Walk the repo and build a symbol index written to .gantry/index.json."""
    base = Path(repo_path)
    if not base.exists():
        return f"Error: repo_path '{repo_path}' does not exist."

    index: dict[str, list[dict]] = {}
    files_scanned = 0
    symbols_found = 0

    for file_path in sorted(base.rglob("*")):
        if not file_path.is_file():
            continue
        if any(part in _INDEX_SKIP for part in file_path.parts):
            continue
        ext = file_path.suffix.lower()
        if ext in _INDEX_BINARY_EXTS:
            continue

        applicable = [(pat, grp, kind) for (exts, pat, grp, kind) in _INDEX_PATTERNS if ext in exts]
        if not applicable:
            continue

        try:
            lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue

        files_scanned += 1
        try:
            rel = str(file_path.relative_to(base))
        except ValueError:
            rel = str(file_path)

        for lineno, line in enumerate(lines, 1):
            for pat, grp, kind in applicable:
                m = re.search(pat, line)
                if not m:
                    continue
                try:
                    name = m.group(grp)
                except IndexError:
                    continue
                if name not in index:
                    index[name] = []
                index[name].append({"file": rel, "line": lineno, "kind": kind})
                symbols_found += 1
                break

    index_path = Path(repo_path) / _INDEX_FILE
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(index, indent=2))

    return (
        f"Index built: {symbols_found} symbol(s) across {files_scanned} file(s). "
        f"Written to {_INDEX_FILE}."
    )


@activity.defn(name="swarm_query_repo_index")
async def swarm_query_repo_index(repo_path: str, query: str, top_k: int = 20) -> str:
    """Query the repo index for symbols matching a name (substring, case-insensitive)."""
    index_path = Path(repo_path) / _INDEX_FILE
    if not index_path.exists():
        return f"Index not built yet for '{repo_path}'. Use find_symbol instead."

    try:
        index: dict = json.loads(index_path.read_text())
    except Exception:
        return "Error reading index (malformed JSON). Use find_symbol instead."

    query_lower = query.lower()
    matches: list[tuple[str, list[dict]]] = [
        (name, locs)
        for name, locs in index.items()
        if query_lower in name.lower()
    ]

    matches.sort(key=lambda x: (x[0].lower() != query_lower, len(x[0])))
    matches = matches[:top_k]

    if not matches:
        return f"No symbols matching '{query}' found in index."

    lines = [f"Symbols matching '{query}' ({len(matches)} result(s)):"]
    for name, locs in matches:
        for loc in locs[:3]:
            lines.append(f"  {name} [{loc['kind']}] → {loc['file']}:{loc['line']}")
    return "\n".join(lines)
