"""
ApprovalWorkflow — durable human-in-the-loop checkpoint.

Spawned as a child workflow by SwarmOrchestrator at key decision points.
Waits indefinitely for an 'approve' signal from the frontend via the
/api/tasks/[taskId]/signal Next.js route.
"""
import asyncio
from temporalio import workflow


@workflow.defn(name="keystone_approval")
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
