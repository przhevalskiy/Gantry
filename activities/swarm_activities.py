"""
Backward-compatibility re-export shim.

All activity implementations have been split into focused domain modules:
  activities/file_activities.py     — file I/O and filesystem search
  activities/shell_activities.py    — shell commands, installs, migrations, deploy
  activities/security_activities.py — secret scanning
  activities/git_activities.py      — git operations and PR creation
  activities/github_activities.py   — GitHub repo creation and project registry
  activities/web_activities.py      — web search and URL fetching
  activities/manifest_activities.py — shared build manifest
  activities/memory_activities.py   — agent memory (facts + episodes + swarm_ aliases)
  activities/index_activities.py    — symbol search and repo index

Import from the domain files directly for new code.
"""
from activities.file_activities import (
    swarm_list_directory,
    swarm_read_file,
    swarm_write_file,
    swarm_patch_file,
    swarm_delete_file,
    swarm_str_replace_editor,
    swarm_search_filesystem,
    swarm_find_test_files,
)
from activities.shell_activities import (
    swarm_run_command,
    swarm_run_application_feedback,
    swarm_install_packages,
    swarm_check_secrets,
    swarm_execute_sql,
    swarm_run_migration,
    swarm_list_ports,
    swarm_deploy,
    swarm_verify_build,
)
from activities.security_activities import swarm_scan_secrets
from activities.git_activities import (
    swarm_git_status,
    swarm_git_create_branch,
    swarm_git_add,
    swarm_git_commit,
    swarm_git_push,
    swarm_create_pull_request,
    swarm_git_diff,
    swarm_git_snapshot_save,
    swarm_git_snapshot_restore,
    swarm_git_clone,
    swarm_git_configure_remote,
)
from activities.github_activities import (
    swarm_github_create_repo,
    swarm_update_project_registry,
)
from activities.web_activities import swarm_web_search, swarm_fetch_url
from activities.manifest_activities import manifest_write, manifest_read, manifest_append_edits
from activities.memory_activities import swarm_memory_write, swarm_memory_read
from activities.index_activities import (
    swarm_find_symbol,
    swarm_build_repo_index,
    swarm_query_repo_index,
)

__all__ = [
    "swarm_list_directory",
    "swarm_read_file",
    "swarm_write_file",
    "swarm_patch_file",
    "swarm_delete_file",
    "swarm_str_replace_editor",
    "swarm_search_filesystem",
    "swarm_find_test_files",
    "swarm_run_command",
    "swarm_run_application_feedback",
    "swarm_install_packages",
    "swarm_check_secrets",
    "swarm_execute_sql",
    "swarm_run_migration",
    "swarm_list_ports",
    "swarm_deploy",
    "swarm_verify_build",
    "swarm_scan_secrets",
    "swarm_git_status",
    "swarm_git_create_branch",
    "swarm_git_add",
    "swarm_git_commit",
    "swarm_git_push",
    "swarm_create_pull_request",
    "swarm_git_diff",
    "swarm_git_snapshot_save",
    "swarm_git_snapshot_restore",
    "swarm_git_clone",
    "swarm_git_configure_remote",
    "swarm_github_create_repo",
    "swarm_update_project_registry",
    "swarm_web_search",
    "swarm_fetch_url",
    "manifest_write",
    "manifest_read",
    "manifest_append_edits",
    "swarm_memory_write",
    "swarm_memory_read",
    "swarm_find_symbol",
    "swarm_build_repo_index",
    "swarm_query_repo_index",
]
