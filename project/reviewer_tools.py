"""
Tools available to the ReviewerAgent.
"""

REVIEWER_TOOLS = [
    {
        "name": "read_file",
        "description": "Read a file from the repository for context.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to the file."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "list_directory",
        "description": "List contents of a directory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "recursive": {"type": "boolean", "default": False},
            },
            "required": ["path"],
        },
    },
    {
        "name": "search_files",
        "description": "Search for callers of a function or usages of a symbol across the codebase to verify API contracts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Content regex or filename glob."},
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
        "name": "find_symbol",
        "description": "Find where a function, class, or type is defined and all files that reference it. Use to verify callers match the new signature.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Symbol name to look up."},
                "repo_path": {"type": "string", "description": "Absolute repo root path."},
            },
            "required": ["symbol", "repo_path"],
        },
    },
    {
        "name": "git_diff",
        "description": "Get the git diff of changed files to review the actual changes made.",
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
        "name": "report_review",
        "description": "Submit the code review verdict.",
        "input_schema": {
            "type": "object",
            "properties": {
                "verdict": {
                    "type": "string",
                    "enum": ["approve", "request_changes"],
                    "description": (
                        "'approve' if the implementation correctly achieves the goal. "
                        "'request_changes' only for real logic bugs, missing edge cases, "
                        "or broken API contracts — not for style or naming preferences."
                    ),
                },
                "comments": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "file": {"type": "string"},
                            "line": {"type": "integer"},
                            "issue": {"type": "string"},
                            "suggestion": {"type": "string"},
                            "severity": {
                                "type": "string",
                                "enum": ["critical", "major", "minor"],
                            },
                        },
                        "required": ["file", "issue", "suggestion", "severity"],
                    },
                    "description": "Required when verdict is request_changes.",
                },
                "summary": {
                    "type": "string",
                    "description": "One-paragraph summary of the review.",
                },
            },
            "required": ["verdict", "summary"],
        },
    },
]

REVIEWER_VALID_TOOL_NAMES: frozenset[str] = frozenset(t["name"] for t in REVIEWER_TOOLS)
