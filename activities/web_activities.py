"""Web search and URL fetch activities."""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request

from temporalio import activity

from activities._shared import logger


@activity.defn(name="swarm_web_search")
async def swarm_web_search(query: str, num_results: int = 5) -> str:
    """Search the web. Uses Brave Search API if BRAVE_SEARCH_API_KEY is set, else DuckDuckGo."""
    import os
    num_results = min(num_results, 10)
    brave_key = os.environ.get("BRAVE_SEARCH_API_KEY")

    if brave_key:
        try:
            url = f"https://api.search.brave.com/res/v1/web/search?q={urllib.parse.quote(query)}&count={num_results}"
            req = urllib.request.Request(url, headers={
                "Accept": "application/json",
                "X-Subscription-Token": brave_key,
            })
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read())
            results = data.get("web", {}).get("results", [])
            if results:
                lines: list[str] = []
                for r in results[:num_results]:
                    lines.append(f"**{r.get('title', '')}**")
                    lines.append(r.get("url", ""))
                    if r.get("description"):
                        lines.append(r["description"])
                    lines.append("")
                return "\n".join(lines).strip()
        except Exception:
            pass

    try:
        ddg_url = (
            f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}"
            "&format=json&no_redirect=1&no_html=1&skip_disambig=1"
        )
        req = urllib.request.Request(ddg_url, headers={"User-Agent": "Gantry/1.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read())
        lines = []
        if data.get("AbstractText"):
            lines.append(data["AbstractText"])
            if data.get("AbstractURL"):
                lines.append(f"Source: {data['AbstractURL']}")
            lines.append("")
        for topic in data.get("RelatedTopics", [])[:num_results]:
            if isinstance(topic, dict) and topic.get("Text"):
                lines.append(f"- {topic['Text']}")
                if topic.get("FirstURL"):
                    lines.append(f"  {topic['FirstURL']}")
        if lines:
            lines.append("\nTip: Set BRAVE_SEARCH_API_KEY for full web search results.")
            return "\n".join(lines).strip()
        return (
            f"No instant-answer results for '{query}'.\n"
            "Set BRAVE_SEARCH_API_KEY in the worker environment for full web search."
        )
    except Exception as e:
        return (
            f"Web search unavailable: {e}\n"
            "Set BRAVE_SEARCH_API_KEY in the worker environment to enable web search."
        )


@activity.defn(name="swarm_fetch_url")
async def swarm_fetch_url(url: str, max_chars: int = 8000) -> str:
    """Fetch a URL and return its text content with HTML stripped."""
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; Gantry/1.0)",
            "Accept": "text/html,text/plain,application/xhtml+xml,*/*",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("content-type", "")
            raw = resp.read(max_chars * 4)
        text = raw.decode("utf-8", errors="replace")
        if "html" in content_type.lower() or text.lstrip().startswith("<"):
            text = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", "", text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"[ \t]{2,}", " ", text)
            text = re.sub(r"\n{3,}", "\n\n", text.strip())
        if len(text) > max_chars:
            text = text[:max_chars] + f"\n\n[truncated — showing {max_chars} of {len(text)} chars]"
        return text.strip() or "(empty response)"
    except Exception as e:
        return f"Error fetching '{url}': {e}"
