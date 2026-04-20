"""
Temporal worker bootstrap — Swarm Factory (Durable Software Engineering Engine).

Pipeline: SwarmOrchestrator → ArchitectAgent → BuilderAgent
          → InspectorAgent (self-healing loop) → SecurityAgent → DevOpsAgent
"""
import asyncio
import os

from agentex.lib.core.temporal.activities import get_all_activities
from agentex.lib.core.temporal.workers.worker import AgentexWorker
from agentex.lib.utils.logging import make_logger
from agentex.lib.environment_variables import EnvironmentVariables

from workflows.swarm_orchestrator import SwarmOrchestrator
from workflows.architect_agent import ArchitectAgent
from workflows.builder_agent import BuilderAgent
from workflows.inspector_agent import InspectorAgent
from workflows.security_agent import SecurityAgent
from workflows.devops_agent import DevOpsAgent

from activities.swarm_activities import (
    swarm_list_directory,
    swarm_read_file,
    swarm_write_file,
    swarm_patch_file,
    swarm_delete_file,
    swarm_run_command,
    swarm_scan_secrets,
    swarm_git_status,
    swarm_git_create_branch,
    swarm_git_add,
    swarm_git_commit,
    swarm_git_push,
    swarm_create_pull_request,
)
from activities.architect_planner_activity import plan_architect_step
from activities.builder_planner_activity import plan_builder_step
from activities.inspector_planner_activity import plan_inspector_step
from activities.security_planner_activity import plan_security_step
from activities.devops_planner_activity import plan_devops_step

logger = make_logger(__name__)


async def main():
    env = EnvironmentVariables.refresh()
    task_queue = env.WORKFLOW_TASK_QUEUE or os.getenv("WORKFLOW_TASK_QUEUE", "web_scout_queue")

    custom_activities = [
        swarm_list_directory,
        swarm_read_file,
        swarm_write_file,
        swarm_patch_file,
        swarm_delete_file,
        swarm_run_command,
        swarm_scan_secrets,
        swarm_git_status,
        swarm_git_create_branch,
        swarm_git_add,
        swarm_git_commit,
        swarm_git_push,
        swarm_create_pull_request,
        plan_architect_step,
        plan_builder_step,
        plan_inspector_step,
        plan_security_step,
        plan_devops_step,
    ]

    all_activities = get_all_activities() + custom_activities

    worker = AgentexWorker(
        task_queue=task_queue,
        max_workers=20,
        max_concurrent_activities=20,
    )

    logger.info(f"starting_worker task_queue={task_queue}")
    await worker.run(
        activities=all_activities,
        workflows=[
            SwarmOrchestrator,
            ArchitectAgent,
            BuilderAgent,
            InspectorAgent,
            SecurityAgent,
            DevOpsAgent,
        ],
    )


if __name__ == "__main__":
    asyncio.run(main())
