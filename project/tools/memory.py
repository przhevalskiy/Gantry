"""
Shared memory tool schemas — used by PM, Architect, Builder, Inspector, Security, DevOps.

Three tools:
  memory_write          — write a fact (replaces build-context write)
  memory_read           — read facts (replaces build-context read)
  memory_search_episodes — search past build episodes by keyword
"""

MEMORY_WRITE_TOOL: dict = {
    "name": "memory_write",
    "description": (
        "Store a durable fact in the shared memory layer. "
        "Facts persist across builds and are readable by all agents. "
        "Use to record key decisions, tech constraints, user preferences, "
        "known failure patterns, or architecture notes."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "key": {
                "type": "string",
                "description": (
                    "Scoped key — use agent-prefixed names to avoid collisions, "
                    "e.g. 'pm.user_prefers_typescript', 'arch.db_orm', 'inspector.fragile_module'."
                ),
            },
            "value": {"type": "string", "description": "Fact content."},
            "repo_path": {"type": "string", "description": "Absolute repo root path."},
        },
        "required": ["key", "value", "repo_path"],
    },
}

MEMORY_READ_TOOL: dict = {
    "name": "memory_read",
    "description": (
        "Read facts stored by any agent (current build or past builds). "
        "Call this at the start of your first turn to load relevant context "
        "before planning your work."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "repo_path": {"type": "string", "description": "Absolute repo root path."},
            "keys": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Specific keys to fetch. Omit to return all facts.",
            },
        },
        "required": ["repo_path"],
    },
}

MEMORY_SEARCH_EPISODES_TOOL: dict = {
    "name": "memory_search_episodes",
    "description": (
        "Search past build episodes by keyword to find relevant prior work. "
        "Use to avoid repeating failed approaches, reuse known-good patterns, "
        "or understand how a similar feature was built before."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "repo_path": {"type": "string", "description": "Absolute repo root path."},
            "query": {
                "type": "string",
                "description": "Keywords describing the current goal or area of interest.",
            },
            "top_k": {
                "type": "integer",
                "description": "Number of episodes to return (default 5).",
                "default": 5,
            },
        },
        "required": ["repo_path", "query"],
    },
}
