"""
Web search Temporal Activity — Tavily API.
Zero LLM calls. Zero Agentex SDK imports. (I1)
"""
from __future__ import annotations

import json
from pathlib import Path

import structlog
from temporalio import activity

from project.config import TAVILY_API_KEY, USE_MOCK_SEARCH

logger = structlog.get_logger(__name__)

_MOCK_SEARCH_PATH = Path(__file__).parent.parent / "fixtures" / "mock_search.json"


def _load_mock_search() -> list[dict]:
    with open(_MOCK_SEARCH_PATH) as f:
        mock_data: dict = json.load(f)
    return mock_data.get("default", [])


@activity.defn(name="search_web")
async def search_web(query: str, max_results: int = 7) -> list[dict]:
    """
    Search the web via Tavily API.
    Returns a list of {title, url, snippet} dicts.
    """
    log = logger.bind(query=query, max_results=max_results)

    if USE_MOCK_SEARCH:
        log.info("search_web_mock")
        return _load_mock_search()

    from tavily import AsyncTavilyClient

    client = AsyncTavilyClient(api_key=TAVILY_API_KEY)
    log.info("search_web_live")
    response = await client.search(
        query=query,
        max_results=max_results,
        search_depth="advanced",
        include_answer=True,
    )
    results = [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "snippet": r.get("content", ""),
        }
        for r in response.get("results", [])
    ]
    log.info("search_web_ok", result_count=len(results))
    return results
