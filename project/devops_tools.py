"""
Tool schemas for the DevOps agent (GitSkill).
Handles branching, committing, signing, and PR creation.
"""

DEVOPS_TOOLS: list[dict] = [
    {
        "name": "git_status",
        "description": "Get the current git status — staged, unstaged, and untracked files.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": [],
        },
    },
    {
        "name": "git_create_branch",
        "description": "Create and checkout a new git branch.",
        "input_schema": {
            "type": "object",
            "properties": {
                "branch_name": {"type": "string", "description": "Name of the new branch."},
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["branch_name"],
        },
    },
    {
        "name": "git_add",
        "description": "Stage files for commit.",
        "input_schema": {
            "type": "object",
            "properties": {
                "paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of file paths to stage. Use ['.'] to stage all.",
                },
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["paths"],
        },
    },
    {
        "name": "git_commit",
        "description": "Commit staged changes with a message.",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "Commit message (conventional commits format preferred)."},
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["message"],
        },
    },
    {
        "name": "git_push",
        "description": "Push the current branch to the remote origin.",
        "input_schema": {
            "type": "object",
            "properties": {
                "branch_name": {"type": "string", "description": "Branch to push."},
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["branch_name"],
        },
    },
    {
        "name": "create_pull_request",
        "description": (
            "Create a pull request on GitHub/GitLab. "
            "Requires GH_TOKEN or GITLAB_TOKEN environment variable."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "PR title."},
                "body": {"type": "string", "description": "PR description (markdown)."},
                "base_branch": {"type": "string", "description": "Target branch (default: main).", "default": "main"},
                "head_branch": {"type": "string", "description": "Source branch with changes."},
                "cwd": {"type": "string", "description": "Working directory (default: repo root)."},
            },
            "required": ["title", "body", "head_branch"],
        },
    },
    {
        "name": "run_migration",
        "description": (
            "Run database migrations before or after deploying. "
            "Auto-detects alembic, prisma, knex, or rails from project files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tool": {
                    "type": "string",
                    "enum": ["auto", "alembic", "prisma", "knex", "rails", "flyway"],
                    "description": "Migration tool ('auto' detects from project files).",
                },
                "cwd": {"type": "string", "description": "Working directory (repo root)."},
                "command": {"type": "string", "description": "Command override (e.g. 'upgrade head')."},
            },
            "required": [],
        },
    },
    {
        "name": "deploy",
        "description": (
            "Deploy the application to a hosting platform. "
            "Auto-detects Vercel, Railway, Fly.io, Netlify, or Heroku from config files and environment tokens."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "enum": ["auto", "vercel", "railway", "fly", "netlify", "heroku"],
                    "description": "Deployment platform ('auto' detects from config + env tokens).",
                },
                "cwd": {"type": "string", "description": "Working directory (repo root)."},
            },
            "required": [],
        },
    },
    {
        "name": "memory_read",
        "description": "Read context notes from Architect or Builder agents — useful to include in the PR description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo_path": {"type": "string", "description": "Absolute repo root path."},
                "keys": {"type": "array", "items": {"type": "string"}, "description": "Specific keys to fetch. Omit for all."},
            },
            "required": ["repo_path"],
        },
    },
    {
        "name": "report_devops",
        "description": "Call this when all git operations are complete.",
        "input_schema": {
            "type": "object",
            "properties": {
                "branch": {"type": "string", "description": "Branch name used."},
                "commit_sha": {"type": "string", "description": "SHA of the final commit."},
                "pr_url": {"type": "string", "description": "URL of the created PR (if any)."},
                "success": {"type": "boolean"},
                "summary": {"type": "string", "description": "Summary of git operations performed."},
            },
            "required": ["branch", "success", "summary"],
        },
    },
]

DEVOPS_VALID_TOOL_NAMES: frozenset[str] = frozenset(t["name"] for t in DEVOPS_TOOLS)
