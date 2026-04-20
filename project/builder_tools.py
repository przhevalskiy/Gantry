"""
Tool schemas for the Builder agent (CodeWriterSkill).
Writes, modifies, and deletes files in the local repo.
"""

BUILDER_TOOLS: list[dict] = [
    {
        "name": "read_file",
        "description": "Read the current contents of a file before modifying it.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path to the file."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": (
            "Write (create or overwrite) a file with the given content. "
            "Use this to create new files or fully replace existing ones."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path to the file."},
                "content": {"type": "string", "description": "Full file content to write."},
                "description": {"type": "string", "description": "One-line description of what this change does."},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "patch_file",
        "description": (
            "Apply a targeted string replacement to an existing file. "
            "Prefer this over write_file for small, surgical edits."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path to the file."},
                "old_str": {"type": "string", "description": "Exact string to find and replace."},
                "new_str": {"type": "string", "description": "Replacement string."},
                "description": {"type": "string", "description": "One-line description of the change."},
            },
            "required": ["path", "old_str", "new_str"],
        },
    },
    {
        "name": "delete_file",
        "description": "Delete a file from the repository.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path to the file to delete."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_command",
        "description": (
            "Run a shell command in the repo directory (e.g. 'pip install -r requirements.txt', "
            "'npm install'). Use for dependency installation only — not for tests."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to run."},
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["command"],
        },
    },
    {
        "name": "finish_build",
        "description": (
            "Call this when all code changes are complete. "
            "Provide a summary of every file you created or modified."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "What was built and why."},
                "edits": {
                    "type": "array",
                    "description": "List of all file edits made.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "operation": {"type": "string", "enum": ["create", "modify", "delete"]},
                            "description": {"type": "string"},
                        },
                        "required": ["path", "operation"],
                    },
                },
            },
            "required": ["summary", "edits"],
        },
    },
]

BUILDER_VALID_TOOL_NAMES: frozenset[str] = frozenset(t["name"] for t in BUILDER_TOOLS)
