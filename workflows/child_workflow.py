"""
Durable child workflows for human-in-the-loop checkpoints.

ApprovalWorkflow  — approve/reject a checkpoint (boolean signal).
ClarificationWorkflow — collect text answers to PM questions (dict signal).

Both are spawned by PMAgent / SwarmOrchestrator and signalled via the
/api/tasks/[taskId]/signal Next.js route.
"""
import asyncio
from datetime import timedelta
from temporalio import workflow


@workflow.defn(name="gantry_approval")
class ApprovalWorkflow:
    def __init__(self):
        self._queue: asyncio.Queue[bool] = asyncio.Queue()

    @workflow.run
    async def run(self, action: str) -> str:
        await workflow.wait_condition(lambda: not self._queue.empty())
        approved = await self._queue.get()
        return "Approved" if approved else "Rejected"

    @workflow.signal
    async def approve(self, approved: bool) -> None:
        await self._queue.put(approved)


@workflow.defn(name="gantry_clarification")
class ClarificationWorkflow:
    """
    Waits for the user to answer PM clarification questions.
    Returns a dict mapping each question to its answer.
    Times out after 48 h and returns {} so the build proceeds with original goal.
    """

    def __init__(self):
        self._answers: dict | None = None

    @workflow.run
    async def run(self, questions: list[str]) -> dict:
        timed_out = not await workflow.wait_condition(
            lambda: self._answers is not None,
            timeout=timedelta(hours=48),
        )
        if timed_out:
            return {}
        return self._answers or {}

    @workflow.signal
    async def submit(self, answers: dict) -> None:
        self._answers = answers
