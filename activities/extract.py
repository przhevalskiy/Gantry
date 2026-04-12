"""
Content extraction and cleaning Temporal Activities.
Zero LLM calls. Zero Agentex SDK imports. (I1)
"""
from __future__ import annotations

import structlog
from temporalio import activity

logger = structlog.get_logger(__name__)

_MAX_PAGE_CHARS = 15000
_MAX_CONTEXT_CHARS = 25000


@activity.defn(name="extract_page_content")
async def extract_page_content(html: str) -> str:
    """
    Strip nav/footer/scripts/ads from HTML and return clean readable text.
    Truncated to 15000 chars max.
    """
    from bs4 import BeautifulSoup

    log = logger.bind(html_bytes=len(html))

    soup = BeautifulSoup(html, "lxml")

    # Remove non-content tags
    for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                     "noscript", "form", "iframe", "svg", "button"]):
        tag.decompose()

    # Remove common ad/navigation class patterns
    for tag in soup.find_all(class_=lambda c: c and any(
        kw in c.lower() for kw in ("nav", "menu", "sidebar", "footer", "ad", "banner", "cookie")
    )):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    # Collapse excessive blank lines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = "\n".join(lines)

    if len(cleaned) > _MAX_PAGE_CHARS:
        cleaned = cleaned[:_MAX_PAGE_CHARS] + "\n[content truncated]"

    log.info("extract_ok", output_chars=len(cleaned))
    return cleaned


@activity.defn(name="summarize_results")
async def summarize_results(results: list[str]) -> str:
    """
    Join multiple extracted page texts into a single context string for the LLM.
    Truncated to 12000 chars total.
    """
    joined = "\n\n---\n\n".join(results)
    if len(joined) > _MAX_CONTEXT_CHARS:
        joined = joined[:_MAX_CONTEXT_CHARS] + "\n[context truncated]"
    logger.info("summarize_results_ok", total_chars=len(joined))
    return joined
