"""Tool schemas for the Architect agent (RepoMapSkill)."""

ARCHITECT_TOOLS: list[dict] = [
    {
        "name": "list_directory",
        "description": (
            "List the contents of a directory in the repository. "
            "ALWAYS pass the absolute path (e.g. the repo_root you were given, or a subdirectory of it). "
            "Use this to explore the project structure before reading files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to the directory (e.g. '/Users/alice/myproject' or '/Users/alice/myproject/src')."},
                "max_depth": {"type": "integer", "description": "Max recursion depth (default 2).", "default": 2},
            },
            "required": ["path"],
        },
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file in the repository. ALWAYS use the absolute path.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to the file (e.g. '/Users/alice/myproject/src/main.py')."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "search_files",
        "description": (
            "Search for files by name pattern (glob) or by content (regex). "
            "Use to locate relevant files before reading them, especially in large repos."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern (e.g. '*.py', 'config.*') or regex for content search.",
                },
                "path": {
                    "type": "string",
                    "description": "Absolute path of root directory to search.",
                },
                "type": {
                    "type": "string",
                    "enum": ["name", "content"],
                    "description": "'name' matches filenames, 'content' searches file text. Default: 'name'.",
                },
            },
            "required": ["pattern", "path"],
        },
    },
    {
        "name": "web_search",
        "description": (
            "Search the web for documentation, package versions, architecture patterns, or API references. "
            "Use when you're uncertain about a library's API or want to verify an approach before planning."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query."},
                "num_results": {"type": "integer", "description": "Number of results (default: 5, max: 10)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "fetch_url",
        "description": "Fetch a documentation URL, README, or changelog and return its text. Use to read API docs or package changelogs.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to fetch."},
                "max_chars": {"type": "integer", "description": "Max characters to return (default: 8000)."},
            },
            "required": ["url"],
        },
    },
    {
        "name": "memory_write",
        "description": (
            "Store a durable fact for all agents — current build and future builds. "
            "Use to record key decisions, missing secrets, DB schema, architecture constraints. "
            "Use scoped keys, e.g. 'arch.db_orm', 'arch.auth_pattern', 'arch.monorepo'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "key": {"type": "string", "description": "Scoped fact key (e.g. 'arch.db_orm')."},
                "value": {"type": "string", "description": "Fact content."},
                "repo_path": {"type": "string", "description": "Absolute repo root path."},
            },
            "required": ["key", "value", "repo_path"],
        },
    },
    {
        "name": "memory_search_episodes",
        "description": (
            "Search past build episodes to find prior decisions for similar goals. "
            "Call early in planning to avoid repeating failed approaches."
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
        "name": "check_secrets",
        "description": (
            "Check whether required environment variables (API keys, tokens, DB URLs) are present "
            "in the worker environment. Call this early if the project requires secrets — "
            "report missing ones in the plan notes so builders can surface the issue."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Environment variable names to check (e.g. ['DATABASE_URL', 'OPENAI_API_KEY']).",
                },
            },
            "required": ["names"],
        },
    },
    {
        "name": "report_plan",
        "description": (
            "Call this when you have fully mapped the repository and are ready to produce "
            "the implementation plan. Decompose the work into independent parallel tracks "
            "that can be built simultaneously. Each track should touch distinct files with "
            "minimal overlap. For small tasks, a single track is fine."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "repo_root": {"type": "string", "description": "Absolute or relative root of the repo."},
                "tech_stack": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Languages, frameworks, and tools detected.",
                },
                "tracks": {
                    "type": "array",
                    "description": (
                        "Independent parallel workstreams for the Builder swarm. "
                        "Each track is assigned to a separate Builder agent running in parallel. "
                        "Use 1 track for small tasks, 2-4 tracks for larger ones. "
                        "Tracks must touch different files to avoid conflicts."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {
                                "type": "string",
                                "description": "Short name for this track, e.g. 'backend', 'frontend', 'tests', 'infra'.",
                            },
                            "implementation_steps": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Ordered steps for this track's Builder to execute.",
                            },
                            "key_files": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Files this track will create or modify.",
                            },
                        },
                        "required": ["label", "implementation_steps"],
                    },
                    "minItems": 1,
                },
                "notes": {"type": "string", "description": "Additional context for the team."},
            },
            "required": ["repo_root", "tracks"],
        },
    },
]

ARCHITECT_VALID_TOOL_NAMES: frozenset[str] = frozenset(t["name"] for t in ARCHITECT_TOOLS)

