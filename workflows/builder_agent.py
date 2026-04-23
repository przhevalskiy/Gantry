"""
BuilderAgent — CodeWriterSkill.
Receives an ArchitectPlan and executes it by writing, patching, and deleting files.
Returns a BuildResult JSON.
"""
from __future__ import annotations

import json
import structlog
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

from agentex.lib import adk
from agentex.types.text_content import TextContent

with workflow.unsafe.imports_passed_through():
    from project.builder_tools import BUILDER_VALID_TOOL_NAMES

logger = structlog.get_logger(__name__)

MAX_BUILDER_TURNS = 30

PLANNER_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=120),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}
IO_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=60),
    "retry_policy": RetryPolicy(maximum_attempts=3),
}
CMD_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=30),  # Builder commands are mkdir/touch only
    "retry_policy": RetryPolicy(maximum_attempts=1),
}
INSTALL_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=360),
    "retry_policy": RetryPolicy(maximum_attempts=1),
}


@workflow.defn(name="BuilderAgent")
class BuilderAgent:
    """
    Executes the ArchitectPlan by writing code. Returns BuildResult JSON.
    Can be re-invoked with heal_instructions from the Inspector.
    """

    @workflow.run
    async def run(
        self,
        goal: str,
        architect_plan: dict,
        parent_task_id: str,
        heal_instructions: list[str] | None = None,
        track_label: str | None = None,
        manifest_snapshot: str | None = None,
        model: str | None = None,
    ) -> str:
        tag = f"Builder ({track_label})" if track_label else "Builder"
        log = logger.bind(parent_task_id=parent_task_id, track=track_label)
        log.info("builder_started", heal_cycle=bool(heal_instructions))

        heal_section = ""
        if heal_instructions:
            heal_section = (
                "\n\nHEAL INSTRUCTIONS from Inspector (fix these before finishing):\n"
                + "\n".join(f"  - {h}" for h in heal_instructions)
            )

        manifest_section = ""
        if manifest_snapshot:
            try:
                manifest = json.loads(manifest_snapshot)
                sibling_tracks = [
                    t for t in manifest.get("tracks", [])
                    if t.get("label") != track_label
                ]
                own_track = next(
                    (t for t in manifest.get("tracks", []) if t.get("label") == track_label),
                    None,
                )
                lines = ["\n\nSHARED MANIFEST — collaboration context from the Architect:"]
                if own_track:
                    own_files = own_track.get("key_files", [])
                    lines.append(f"\nYour track ({track_label}) OWNS these files — write freely:")
                    lines.extend(f"  {f}" for f in own_files)
                if sibling_tracks:
                    lines.append("\nSIBLING TRACKS running in parallel — DO NOT write their files:")
                    for st in sibling_tracks:
                        st_files = st.get("key_files", [])
                        st_exports = st.get("exports", [])
                        lines.append(f"\n  [{st['label']}] owns: {', '.join(st_files[:8]) or '(TBD)'}")
                        if st_exports:
                            lines.append(f"    exports for you to import: {', '.join(st_exports)}")
                completed = manifest.get("completed_edits", [])
                if completed:
                    written = list({e["path"] for e in completed})[:12]
                    lines.append(f"\nAlready written by other builders: {', '.join(written)}")
                    lines.append("  Prefer patch_file / str_replace_editor over write_file for these paths.")
                manifest_section = "\n".join(lines)
            except Exception:
                pass  # malformed manifest — skip silently

        steps_text = "\n".join(
            f"  {i+1}. {s}" for i, s in enumerate(architect_plan.get("implementation_steps", []))
        )
        key_files = architect_plan.get("key_files", [])
        if key_files and isinstance(key_files[0], dict):
            key_files_text = "\n".join(
                f"  - {f.get('path', '')} ({f.get('language', '')}): {f.get('summary', '')}"
                for f in key_files
            )
        else:
            key_files_text = "\n".join(f"  - {f}" for f in key_files)

        _steps = heal_instructions if heal_instructions else architect_plan.get("implementation_steps", [])
        _header = "Healing" if heal_instructions else "Starting"
        _numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(_steps[:8]))
        if len(_steps) > 8:
            _numbered += f"\n… +{len(_steps) - 8} more"
        await adk.messages.create(
            task_id=parent_task_id,
            content=TextContent(
                author="agent",
                content=f"[{tag}] {_header}:\n{_numbered}",
            ),
        )

        repo_root = architect_plan.get('repo_root', '.')

        # ── #12: Test-driven building — inject test spec if architect provided one ──
        track_test_spec = architect_plan.get("test_spec", [])
        tdd_section = ""
        if track_test_spec and not heal_instructions:
            test_cases = "\n".join(f"  - {tc}" for tc in track_test_spec[:12])
            tdd_section = (
                "\n\nTEST-DRIVEN DEVELOPMENT — follow this order strictly:\n"
                "STEP 1: Write the following tests FIRST (before any implementation):\n"
                f"{test_cases}\n"
                "STEP 2: Run verify_build to confirm the tests exist and are syntactically valid.\n"
                "STEP 3: Implement the code to make the tests pass.\n"
                "STEP 4: Run verify_build again to confirm tests pass.\n"
                "STEP 5: Call finish_build.\n"
                "Do NOT skip to implementation before writing tests."
            )

        task_prompt = (
            f"You are the Builder agent{f' working on the {track_label} track' if track_label else ''}. "
            f"Your goal:\n{goal}\n\n"
            f"Tech stack: {', '.join(architect_plan.get('tech_stack', []))}\n"
            f"Repo root: {repo_root}\n\n"
            f"Key files:\n{key_files_text}\n\n"
            f"Implementation steps:\n{steps_text}"
            f"{heal_section}"
            f"{tdd_section}"
            f"{manifest_section}\n\n"
            "RULES — read carefully before starting:\n"
            f"- ALL file paths MUST be absolute, starting with {repo_root}. "
            f"Example: {repo_root}/src/App.tsx — NEVER just src/App.tsx.\n"
            "- Use read_file to read files. NEVER use run_command to cat or read files.\n"
            "- For package installation use install_packages — do NOT use run_command for installs.\n"
            "- Use str_replace_editor (preferred) or patch_file for targeted edits; write_file for new files.\n"
            "- Use query_index first to locate symbol definitions, then find_symbol if not indexed, then read_file.\n"
            "- Use search_files to locate files by name or content before editing.\n"
            "- Use web_search / fetch_url when uncertain about a library's API or an error message.\n"
            "- Use git_diff before finish_build to verify all intended changes are present.\n"
            f"- Use memory_read(repo_path='{repo_root}') at the start to check Architect notes.\n"
            f"- Call verify_build(repo_path='{repo_root}') after all files are written. Fix any failures before finishing.\n"
            "- Call finish_build only after verify_build passes (or reports no tools detected)."
        )

        from project.config import CLAUDE_SONNET_MODEL
        _model = model or CLAUDE_SONNET_MODEL
        context: list[dict] = []
        edits: list[dict] = []

        for turn in range(MAX_BUILDER_TURNS):
            raw = await workflow.execute_activity(
                "plan_builder_step",
                args=[task_prompt, context, _model],
                **PLANNER_OPTIONS,
            )
            context = raw["context"]

            if raw["type"] == "finish":
                build_data = raw["build_data"]
                tool_use_id = raw["tool_use_id"]
                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": "Build complete."}],
                }]
                all_edits = edits + build_data.get("edits", [])
                log.info("builder_finished", turn=turn, edits=len(all_edits))
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=f"[{tag}] Done — {len(all_edits)} file(s) modified.",
                    ),
                )
                return json.dumps({
                    "success": True,
                    "edits": all_edits,
                    "summary": build_data.get("summary", "Build complete."),
                    "errors": [],
                })

            if raw["type"] == "final":
                log.warning("builder_no_finish_tool", turn=turn)
                return json.dumps({"success": True, "edits": edits, "summary": raw["answer"], "errors": []})

            if raw["type"] == "error":
                log.warning("builder_planner_error", message=raw.get("message"))
                break

            tool_name = raw["tool_name"]
            tool_use_id = raw["tool_use_id"]
            tool_input = raw["tool_input"]

            if tool_name not in BUILDER_VALID_TOOL_NAMES:
                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id,
                                 "content": f"Unknown tool '{tool_name}'."}],
                }]
                continue

            await adk.messages.create(
                task_id=parent_task_id,
                content=TextContent(
                    author="agent",
                    content=f"[{tag}] {tool_name}: {tool_input.get('path', tool_input.get('command', ''))}",
                ),
            )

            tool_result = await self._dispatch(tool_name, tool_input)

            # Track edits for the final report
            if tool_name in ("write_file", "patch_file", "delete_file"):
                op = "create" if tool_name == "write_file" else ("delete" if tool_name == "delete_file" else "modify")
                edits.append({
                    "path": tool_input.get("path", ""),
                    "operation": op,
                    "description": tool_input.get("description", ""),
                })

            context = context + [{
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": str(tool_result)}],
            }]

        log.warning("builder_max_turns")
        return json.dumps({"success": False, "edits": edits, "summary": "Builder hit max turns.", "errors": ["max_turns"]})

    async def _dispatch(self, tool_name: str, tool_input: dict) -> str:
        if tool_name == "read_file":
            return await workflow.execute_activity(
                "swarm_read_file", args=[tool_input.get("path", "")], **IO_OPTIONS
            )
        if tool_name == "write_file":
            return await workflow.execute_activity(
                "swarm_write_file",
                args=[tool_input.get("path", ""), tool_input.get("content", "")],
                **IO_OPTIONS,
            )
        if tool_name == "patch_file":
            return await workflow.execute_activity(
                "swarm_patch_file",
                args=[tool_input.get("path", ""), tool_input.get("old_str", ""), tool_input.get("new_str", "")],
                **IO_OPTIONS,
            )
        if tool_name == "str_replace_editor":
            return await workflow.execute_activity(
                "swarm_str_replace_editor",
                args=[
                    tool_input.get("command", "view"),
                    tool_input.get("path", ""),
                    tool_input.get("old_str", ""),
                    tool_input.get("new_str", ""),
                    tool_input.get("view_range"),
                ],
                **IO_OPTIONS,
            )
        if tool_name == "search_files":
            return await workflow.execute_activity(
                "swarm_search_filesystem",
                args=[tool_input.get("pattern", ""), tool_input.get("path", "."), tool_input.get("type", "name")],
                **IO_OPTIONS,
            )
        if tool_name == "install_packages":
            return await workflow.execute_activity(
                "swarm_install_packages",
                args=[
                    tool_input.get("manager", "npm"),
                    tool_input.get("packages"),
                    tool_input.get("flags", ""),
                    tool_input.get("cwd"),
                ],
                **INSTALL_OPTIONS,
            )
        if tool_name == "delete_file":
            return await workflow.execute_activity(
                "swarm_delete_file", args=[tool_input.get("path", "")], **IO_OPTIONS
            )
        if tool_name == "run_command":
            return await workflow.execute_activity(
                "swarm_run_command",
                args=[tool_input.get("command", ""), tool_input.get("cwd")],
                **CMD_OPTIONS,
            )
        if tool_name == "web_search":
            return await workflow.execute_activity(
                "swarm_web_search",
                args=[tool_input.get("query", ""), tool_input.get("num_results", 5)],
                **IO_OPTIONS,
            )
        if tool_name == "fetch_url":
            return await workflow.execute_activity(
                "swarm_fetch_url",
                args=[tool_input.get("url", ""), tool_input.get("max_chars", 8000)],
                **IO_OPTIONS,
            )
        if tool_name == "execute_sql":
            return await workflow.execute_activity(
                "swarm_execute_sql",
                args=[tool_input.get("query", ""), tool_input.get("database_url"), tool_input.get("cwd")],
                **IO_OPTIONS,
            )
        if tool_name == "git_diff":
            return await workflow.execute_activity(
                "swarm_git_diff",
                args=[tool_input.get("cwd"), tool_input.get("staged", False), tool_input.get("paths")],
                **IO_OPTIONS,
            )
        if tool_name == "run_migration":
            return await workflow.execute_activity(
                "swarm_run_migration",
                args=[tool_input.get("tool", "auto"), tool_input.get("cwd"), tool_input.get("command")],
                start_to_close_timeout=timedelta(seconds=180),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        if tool_name == "memory_read":
            return await workflow.execute_activity(
                "swarm_memory_read",
                args=[tool_input.get("repo_path", "."), tool_input.get("keys")],
                **IO_OPTIONS,
            )
        if tool_name == "memory_write":
            return await workflow.execute_activity(
                "swarm_memory_write",
                args=[tool_input.get("key", ""), tool_input.get("value", ""), tool_input.get("repo_path", "."), "builder"],
                **IO_OPTIONS,
            )
        if tool_name == "verify_build":
            return await workflow.execute_activity(
                "swarm_verify_build",
                args=[tool_input.get("repo_path", ".")],
                start_to_close_timeout=timedelta(seconds=120),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        if tool_name == "find_symbol":
            return await workflow.execute_activity(
                "swarm_find_symbol",
                args=[tool_input.get("symbol", ""), tool_input.get("repo_path", "."), tool_input.get("exact", False)],
                **IO_OPTIONS,
            )
        if tool_name == "query_index":
            return await workflow.execute_activity(
                "swarm_query_repo_index",
                args=[tool_input.get("repo_path", "."), tool_input.get("query", ""), tool_input.get("top_k", 20)],
                **IO_OPTIONS,
            )
        return f"Error: tool '{tool_name}' not dispatched."
