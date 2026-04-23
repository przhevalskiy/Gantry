"""
Tool schemas for the Project Manager agent.
Scans the repo, identifies ambiguities, and collects user clarifications
before handing an enriched goal to the Architect.
"""

PM_TOOLS: list[dict] = [
    {
        "name": "list_directory",
        "description": (
            "List the contents of a directory to understand the project layout. "
            "Use the absolute repo_root path you were given."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to the directory."},
                "max_depth": {"type": "integer", "description": "Max recursion depth (default 2).", "default": 2},
            },
            "required": ["path"],
        },
    },
    {
        "name": "read_file",
        "description": "Read a file to understand the project context (README, package.json, pyproject.toml, etc.).",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to the file."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "search_files",
        "description": "Search for files by name pattern or content to understand what already exists.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Glob or regex pattern."},
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
        "name": "web_search",
        "description": "Search the web to understand an unfamiliar technology or clarify a domain concept before asking the user.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query."},
                "num_results": {"type": "integer", "description": "Number of results (default 5)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "ask_clarification",
        "description": (
            "Post clarifying questions to the user and wait for their answers before the build starts. "
            "Call this ONCE with all your questions — you cannot call it again. "
            "Ask at most 5 questions. Only ask what you cannot determine from the repo or web search. "
            "If the goal is clear and complete, skip this entirely and call report_pm directly."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Targeted questions for the user (max 5). Focus on scope, constraints, and non-obvious choices.",
                    "maxItems": 5,
                },
                "context": {
                    "type": "string",
                    "description": "Brief summary of what you've understood so far, shown to the user above the questions.",
                },
            },
            "required": ["questions"],
        },
    },
    {
        "name": "memory_write",
        "description": (
            "Store a durable fact for all agents to read — current build and future builds. "
            "Use scoped keys, e.g. 'pm.user_prefers_typescript', 'pm.db_dialect', 'pm.scope_limit'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "key": {"type": "string", "description": "Scoped fact key."},
                "value": {"type": "string", "description": "Fact content."},
                "repo_path": {"type": "string", "description": "Absolute repo root path."},
            },
            "required": ["key", "value", "repo_path"],
        },
    },
    {
        "name": "memory_search_episodes",
        "description": (
            "Search past build episodes to understand how similar goals were handled before. "
            "Use to avoid repeating failed approaches and to surface relevant prior decisions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "repo_path": {"type": "string", "description": "Absolute repo root path."},
                "query": {"type": "string", "description": "Keywords for the current goal."},
                "top_k": {"type": "integer", "description": "Max episodes to return (default 5)."},
            },
            "required": ["repo_path", "query"],
        },
    },
    {
        "name": "report_pm",
        "description": (
            "Call this when you are ready to hand off to the Architect. "
            "Write an enriched goal that includes the original goal, repo context you discovered, "
            "and any user clarifications received. This is your final output."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "enriched_goal": {
                    "type": "string",
                    "description": (
                        "The original goal rewritten to include: discovered tech stack context, "
                        "user answers to clarifying questions, scope boundaries, and any constraints. "
                        "This becomes the Architect's input — make it concrete and complete."
                    ),
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes for the engineering team.",
                },
            },
            "required": ["enriched_goal"],
        },
    },
]

PM_VALID_TOOL_NAMES: frozenset[str] = frozenset(t["name"] for t in PM_TOOLS)

