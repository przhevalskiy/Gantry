"""Anthropic/Claude backend for the planner."""
from __future__ import annotations

import asyncio
from typing import Any

import anthropic

from project.rate_limit_config import (
    get_rate_config, get_rate_tracker, log_rate_limit_warning,
    log_rate_limit_hit, log_rate_limit_recovery,
)
from project.planner_types import PlannerError

_LLM_SEMAPHORE = asyncio.Semaphore(4)


async def make_claude_request(client: Any, kwargs: dict[str, Any]) -> Any:
    config = get_rate_config()
    tracker = get_rate_tracker()

    if tracker.is_near_limit(config):
        log_rate_limit_warning()

    retry_count = 0
    delay = config.initial_retry_delay

    async with _LLM_SEMAPHORE:
        while retry_count <= config.max_retries:
            try:
                response = await client.messages.create(
                    extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
                    **kwargs,
                )
                if hasattr(response, "usage"):
                    tracker.add_tokens(response.usage.input_tokens, response.usage.output_tokens)
                if retry_count > 0:
                    log_rate_limit_recovery()
                return response

            except anthropic.RateLimitError as e:
                retry_count += 1
                if retry_count > config.max_retries:
                    raise PlannerError(f"Rate limit exhausted after {retry_count} retries: {e}")
                log_rate_limit_hit(retry_count, delay, str(e))
                await asyncio.sleep(delay)
                delay = min(delay * 2, config.max_retry_delay)

            except anthropic.APIError as e:
                raise PlannerError(f"Claude API error: {e}")

            except Exception as e:
                raise PlannerError(f"Unexpected error: {e}")

    raise PlannerError(f"Failed after {config.max_retries} retries")
