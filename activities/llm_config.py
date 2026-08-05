"""Register / clear per-task LLM credentials on the worker."""
from temporalio import activity

from project.llm_store import clear, register


@activity.defn(name="register_task_llm_config")
async def register_task_llm_config(task_id: str, credentials: dict) -> None:
    register(task_id, credentials)


@activity.defn(name="clear_task_llm_config")
async def clear_task_llm_config(task_id: str) -> None:
    clear(task_id)
