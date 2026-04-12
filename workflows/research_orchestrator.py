"""
ResearchOrchestrator — the top-level "web-scout" workflow.

Phase 2 architecture (Scout + Analyst + Critic + Verifier):
  1. Strategist: determine research angles, scout queries, and analyst agent count
  2. Scout: broad search — discovers and ranks source URLs
  3. Analysts: N agents each read a URL batch and extract structured claims
     - Analysts may flag URLs for deeper investigation (spawn_requests)
  4. Critic: reviews all claims, identifies contradictions, requests verification
  5. Verifiers: spawned for contested claims (max MAX_VERIFIERS, convergence by count)
  6. Synthesizer: merges all claims + verdicts into a final structured report

Agent count is dynamic — set by the Strategist based on question complexity (2–8).
Verifier count is capped at MAX_VERIFIERS (convergence Option A).
"""
from __future__ import annotations

import asyncio
import json
import structlog
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

from agentex.lib import adk
from agentex.lib.types.acp import CreateTaskParams, SendEventParams
from agentex.lib.core.temporal.workflows.workflow import BaseWorkflow
from agentex.lib.core.temporal.types.workflow import SignalName
from agentex.lib.environment_variables import EnvironmentVariables
from agentex.types.text_content import TextContent

with workflow.unsafe.imports_passed_through():
    from project.planner import _extract_task_prompt
    from workflows.scout_agent import ScoutAgent
    from workflows.analyst_agent import AnalystAgent
    from workflows.verifier_agent import VerifierAgent

environment_variables = EnvironmentVariables.refresh()

logger = structlog.get_logger(__name__)

# Hard caps
MAX_VERIFIERS = 3  # convergence Option A: cap verifier spawning

STRATEGIST_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=60),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}
CRITIC_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=90),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}
SYNTHESIZE_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=180),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}

SCOUT_EXECUTION_TIMEOUT = timedelta(minutes=3)
ANALYST_EXECUTION_TIMEOUT = timedelta(minutes=10)
VERIFIER_EXECUTION_TIMEOUT = timedelta(minutes=5)


@workflow.defn(name="web-scout")
class ResearchOrchestrator(BaseWorkflow):
    """
    Orchestrates the full research ecosystem:
    Strategist → Scout → Analysts → Critic → Verifiers → Synthesizer
    """

    def __init__(self):
        super().__init__(display_name="web-scout")

    @workflow.signal(name=SignalName.RECEIVE_EVENT)
    async def on_task_event_send(self, params: SendEventParams) -> None:
        logger.info("received_event", task_id=params.task.id)
        await adk.messages.create(
            task_id=params.task.id,
            content=TextContent(
                author="agent",
                content="Research is in progress. Please wait for the result.",
            ),
        )

    @workflow.run
    async def on_task_create(self, params: CreateTaskParams) -> str:
        task_id = params.task.id
        query = _extract_task_prompt(params.params)
        log = logger.bind(task_id=task_id)

        log.info("orchestrator_started", query=query[:80])

        task_queue = environment_variables.WORKFLOW_TASK_QUEUE or "web_scout_queue"

        # ── Step 1: Strategist ───────────────────────────────────────────────
        await adk.messages.create(
            task_id=task_id,
            content=TextContent(author="agent", content="Planning research strategy..."),
        )

        plan: dict = await workflow.execute_activity(
            "plan_research_strategy",
            args=[query],
            **STRATEGIST_OPTIONS,
        )

        scout_queries: list[str] = plan.get("scout_queries", [query])
        agent_count: int = plan.get("agent_count", 3)

        log.info("strategy_set", scout_queries=len(scout_queries), agent_count=agent_count)

        # ── Step 2: Scout ─────────────────────────────────────────────────────
        await adk.messages.create(
            task_id=task_id,
            content=TextContent(
                author="agent",
                content=f"Scout scanning {len(scout_queries)} search angles for sources...",
            ),
        )

        scout_result: str = await workflow.execute_child_workflow(
            ScoutAgent.run,
            args=[scout_queries, query, task_id],
            id=f"{task_id}-scout",
            task_queue=task_queue,
            execution_timeout=SCOUT_EXECUTION_TIMEOUT,
        )

        try:
            raw_sources = json.loads(scout_result)
            all_urls = [s["url"] for s in raw_sources if isinstance(s, dict) and s.get("url")] if isinstance(raw_sources, list) else []
        except (json.JSONDecodeError, ValueError):
            all_urls = []

        log.info("scout_complete", url_count=len(all_urls))

        if not all_urls:
            log.warning("scout_returned_no_urls")
            fallback = "No sources were discovered. Unable to complete research."
            await adk.messages.create(task_id=task_id, content=TextContent(author="agent", content=fallback))
            return fallback

        # ── Step 3: Analysts (parallel) ───────────────────────────────────────
        actual_agent_count = min(agent_count, len(all_urls))
        url_batches = _split_urls(all_urls, actual_agent_count)

        angle_list = "\n".join(f"  {i+1}. Reading {len(b)} sources" for i, b in enumerate(url_batches))
        await adk.messages.create(
            task_id=task_id,
            content=TextContent(
                author="agent",
                content=f"Launching {actual_agent_count} parallel research agents:\n{angle_list}",
            ),
        )

        analyst_handles = [
            workflow.execute_child_workflow(
                AnalystAgent.run,
                args=[batch, query, task_id, i],
                id=f"{task_id}-analyst-{i}",
                task_queue=task_queue,
                execution_timeout=ANALYST_EXECUTION_TIMEOUT,
            )
            for i, batch in enumerate(url_batches)
        ]

        analyst_results: tuple[str, ...] = await asyncio.gather(*analyst_handles)
        log.info("all_analysts_complete", analyst_count=len(analyst_results))

        # Parse claims and spawn requests from all analysts
        all_claims: list[dict] = []
        pending_spawns: list[dict] = []

        for agent_idx, result_json in enumerate(analyst_results):
            try:
                parsed = json.loads(result_json)
                # Support both new {claims, spawn_requests} format and old list format
                if isinstance(parsed, dict):
                    agent_claims = parsed.get("claims", [])
                    agent_spawns = parsed.get("spawn_requests", [])
                elif isinstance(parsed, list):
                    agent_claims = parsed
                    agent_spawns = []
                else:
                    agent_claims, agent_spawns = [], []

                for c in agent_claims:
                    if isinstance(c, dict):
                        c["agent_index"] = agent_idx
                        all_claims.append(c)
                pending_spawns.extend(agent_spawns)
            except (json.JSONDecodeError, ValueError):
                log.warning("analyst_result_parse_failed", agent_idx=agent_idx)

        log.info("claims_collected", total_claims=len(all_claims), pending_spawns=len(pending_spawns))

        # ── Step 4: Critic ────────────────────────────────────────────────────
        await adk.messages.create(
            task_id=task_id,
            content=TextContent(
                author="agent",
                content=f"Critic reviewing {len(all_claims)} claims for contradictions...",
            ),
        )

        critic_result: dict = await workflow.execute_activity(
            "run_critic",
            args=[query, all_claims],
            **CRITIC_OPTIONS,
        )

        critic_spawns: list[dict] = critic_result.get("spawn_requests", [])
        contradictions = critic_result.get("contradictions", [])
        log.info(
            "critic_complete",
            contradictions=len(contradictions),
            critic_spawns=len(critic_spawns),
        )

        if contradictions:
            await adk.messages.create(
                task_id=task_id,
                content=TextContent(
                    author="agent",
                    content=f"Critic found {len(contradictions)} contradiction(s). Spawning verification agents...",
                ),
            )

        # ── Step 5: Verifiers (convergence: cap at MAX_VERIFIERS) ─────────────
        # Merge analyst spawn requests + critic spawn requests, de-dup by URL
        all_spawn_requests = {s["url"]: s for s in (pending_spawns + critic_spawns)}.values()
        capped_spawns = list(all_spawn_requests)[:MAX_VERIFIERS]

        verifier_results: list[dict] = []
        if capped_spawns:
            await adk.messages.create(
                task_id=task_id,
                content=TextContent(
                    author="agent",
                    content=f"Launching {len(capped_spawns)} verification agent(s)...",
                ),
            )

            verifier_handles = [
                workflow.execute_child_workflow(
                    VerifierAgent.run,
                    args=[
                        s.get("claim", s.get("reason", "Verify this source")),
                        s.get("url", ""),
                        s.get("reason", "Flagged for verification"),
                        query,
                        task_id,
                        i,
                    ],
                    id=f"{task_id}-verifier-{i}",
                    task_queue=task_queue,
                    execution_timeout=VERIFIER_EXECUTION_TIMEOUT,
                )
                for i, s in enumerate(capped_spawns)
            ]

            verifier_jsons: tuple[str, ...] = await asyncio.gather(*verifier_handles)
            for vj in verifier_jsons:
                try:
                    verdict = json.loads(vj)
                    if isinstance(verdict, dict):
                        verifier_results.append(verdict)
                except (json.JSONDecodeError, ValueError):
                    pass

            log.info("verifiers_complete", count=len(verifier_results))

        # ── Step 6: Synthesize ────────────────────────────────────────────────
        total_agent_count = actual_agent_count + len(capped_spawns)
        await adk.messages.create(
            task_id=task_id,
            content=TextContent(
                author="agent",
                content=(
                    f"All {total_agent_count} agents complete — "
                    f"{len(all_claims)} claims, {len(verifier_results)} verdicts. Synthesizing..."
                ),
            ),
        )

        # Enrich claims with verifier verdicts
        enriched_claims = _merge_verdicts(all_claims, verifier_results, critic_result)

        final_answer: str = await workflow.execute_activity(
            "synthesize_from_claims",
            args=[query, enriched_claims],
            **SYNTHESIZE_OPTIONS,
        )

        log.info("synthesis_complete", answer_len=len(final_answer))

        await adk.messages.create(
            task_id=task_id,
            content=TextContent(author="agent", content=final_answer),
        )

        return final_answer


def _split_urls(urls: list[str], n: int) -> list[list[str]]:
    """Divide a list of URLs into n roughly equal batches."""
    if n <= 0:
        return [urls]
    batches: list[list[str]] = [[] for _ in range(n)]
    for i, url in enumerate(urls):
        batches[i % n].append(url)
    return [b for b in batches if b]


def _merge_verdicts(
    claims: list[dict],
    verifier_results: list[dict],
    critic_result: dict,
) -> list[dict]:
    """
    Enrich claims with verification verdicts and critic flags.
    Adds 'verified', 'verdict', and 'critic_flag' fields to relevant claims.
    """
    # Build lookup: original_claim text → verdict
    verdict_by_claim: dict[str, dict] = {}
    for v in verifier_results:
        original = v.get("original_claim", "")
        if original:
            verdict_by_claim[original] = v

    flagged_indices = set(critic_result.get("flagged_claims", []))

    enriched = []
    for i, claim in enumerate(claims):
        c = dict(claim)
        claim_text = c.get("claim", "")

        # Attach verdict if this claim was verified
        if claim_text in verdict_by_claim:
            v = verdict_by_claim[claim_text]
            c["verified"] = True
            c["verdict"] = v.get("verdict", "unverifiable")
            c["verdict_explanation"] = v.get("explanation", "")

        # Mark as critic-flagged
        if i in flagged_indices:
            c["critic_flag"] = True

        enriched.append(c)

    return enriched
