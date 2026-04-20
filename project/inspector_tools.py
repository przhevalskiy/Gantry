"""
Tool schemas for the Inspector agent (QASkill).
Runs tests, lints, and type checks. Triggers self-healing if failures found.
"""

INSPECTOR_TOOLS: list[dict] = [
    {
        "name": "run_tests",
        "description": (
            "Run the project's test suite. Returns pass/fail counts and output. "
            "Always run this first."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Test command to run (e.g. 'pytest --tb=short', 'npm test -- --run').",
                },
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["command"],
        },
    },
    {
        "name": "run_lint",
        "description": "Run the linter (e.g. ruff, eslint, flake8) and return issues found.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Lint command (e.g. 'ruff check .')."},
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["command"],
        },
    },
    {
        "name": "run_type_check",
        "description": "Run static type checking (e.g. mypy, pyright, tsc --noEmit).",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Type check command."},
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["command"],
        },
    },
    {
        "name": "read_file",
        "description": "Read a file to understand a test failure or lint error in context.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path to the file."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "report_inspection",
        "description": (
            "Call this when all checks are complete. Report whether the build passed "
            "and provide heal instructions if it failed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "passed": {"type": "boolean", "description": "True if all checks passed."},
                "summary": {"type": "string", "description": "Overall QA summary."},
                "lint_issues": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of lint issues found.",
                },
                "type_errors": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of type errors found.",
                },
                "heal_instructions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Concrete fix instructions for the Builder if checks failed.",
                },
                "test_passed": {"type": "integer", "description": "Number of tests passed."},
                "test_failed": {"type": "integer", "description": "Number of tests failed."},
                "test_errors": {"type": "integer", "description": "Number of test errors."},
            },
            "required": ["passed", "summary"],
        },
    },
]

INSPECTOR_VALID_TOOL_NAMES: frozenset[str] = frozenset(t["name"] for t in INSPECTOR_TOOLS)
