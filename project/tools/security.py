"""
Tool schemas for the Security agent (AuditSkill).
Scans for secrets, vulnerable dependencies, and insecure patterns.
"""

SECURITY_TOOLS: list[dict] = [
    {
        "name": "scan_secrets",
        "description": (
            "Scan the repository for accidentally committed secrets, API keys, "
            "passwords, or tokens using pattern matching."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Directory to scan (default: '.').", "default": "."},
            },
            "required": [],
        },
    },
    {
        "name": "scan_dependencies",
        "description": (
            "Check project dependencies for known CVEs and vulnerabilities. "
            "Supports pip-audit, npm audit, and safety."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Audit command (e.g. 'pip-audit', 'npm audit --json').",
                },
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["command"],
        },
    },
    {
        "name": "read_file",
        "description": "Read a file to inspect it for insecure patterns.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path to the file."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_sast",
        "description": (
            "Run a static application security testing (SAST) tool "
            "(e.g. bandit for Python, semgrep for any language)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "SAST command to run."},
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["command"],
        },
    },
    {
        "name": "git_diff",
        "description": "Get the diff of changed files to focus the security scan on what actually changed, not the entire repo.",
        "input_schema": {
            "type": "object",
            "properties": {
                "paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific file paths to diff. Omit for all changed files.",
                },
                "cwd": {"type": "string", "description": "Repository root directory."},
            },
        },
    },
    {
        "name": "search_files",
        "description": "Search for files by name pattern or content. Use to find all files that import a suspicious package or use an insecure pattern.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Glob pattern or content regex."},
                "path": {"type": "string", "description": "Root directory to search."},
                "type": {
                    "type": "string",
                    "enum": ["name", "content"],
                    "description": "'name' for filename glob, 'content' for text search.",
                },
            },
            "required": ["pattern", "path"],
        },
    },
    {
        "name": "report_audit",
        "description": (
            "Call this when the security audit is complete. "
            "Report all findings and whether the build is safe to merge."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "passed": {
                    "type": "boolean",
                    "description": "True if no critical or high severity findings.",
                },
                "summary": {"type": "string", "description": "Overall security summary."},
                "findings": {
                    "type": "array",
                    "description": "List of security findings.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "severity": {
                                "type": "string",
                                "enum": ["critical", "high", "medium", "low", "info"],
                            },
                            "category": {"type": "string"},
                            "file": {"type": "string"},
                            "line": {"type": "integer"},
                            "description": {"type": "string"},
                            "recommendation": {"type": "string"},
                        },
                        "required": ["severity", "category", "description"],
                    },
                },
            },
            "required": ["passed", "summary"],
        },
    },
]

SECURITY_VALID_TOOL_NAMES: frozenset[str] = frozenset(t["name"] for t in SECURITY_TOOLS)
