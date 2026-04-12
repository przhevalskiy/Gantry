"""
Playwright Temporal Activities — browser I/O only.
Zero LLM calls. Zero Agentex SDK imports. (I1)
Opens a new tab per URL, extracts text, leaves tab open.
Saves a screenshot after each navigation for UI streaming.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import TYPE_CHECKING

# Directory where per-task screenshots are stored
_SCREENSHOT_DIR = Path("/tmp/oumuamua_screenshots")
_SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

import structlog
from temporalio import activity

from project.config import (
    BROWSER_HEADLESS,
    BROWSER_TIMEOUT_MS,
    USE_MOCK_BROWSER,
)

if TYPE_CHECKING:
    from playwright.async_api import Browser, BrowserContext, Playwright

logger = structlog.get_logger(__name__)

_MOCK_NAVIGATE_PATH = Path(__file__).parent.parent / "fixtures" / "mock_navigate.json"

# Persistent browser sessions keyed by workflow_id
_sessions: dict[str, tuple["Playwright", "Browser", "BrowserContext"]] = {}

# URL blocklist — block localhost and private IPs
_BLOCKED_PATTERNS = re.compile(
    r"^https?://(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)",
    re.IGNORECASE,
)


def _is_blocked_url(url: str) -> bool:
    return bool(_BLOCKED_PATTERNS.match(url))


def _load_mock_navigate(url: str) -> str:
    with open(_MOCK_NAVIGATE_PATH) as f:
        mock_data: dict = json.load(f)
    return mock_data.get(url) or mock_data.get("default", "<html><body>Mock page</body></html>")


async def _get_session(workflow_id: str) -> tuple["Playwright", "Browser", "BrowserContext"]:
    if workflow_id not in _sessions:
        from playwright.async_api import async_playwright
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(headless=BROWSER_HEADLESS)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        )
        _sessions[workflow_id] = (playwright, browser, context)
        logger.info("browser_session_created", workflow_id=workflow_id)
    return _sessions[workflow_id]


@activity.defn(name="navigate")
async def navigate(url: str) -> str:
    log = logger.bind(url=url)

    if _is_blocked_url(url):
        log.warning("blocked_url")
        return f"Error: URL '{url}' is blocked."

    if USE_MOCK_BROWSER:
        log.info("navigate_mock")
        return _load_mock_navigate(url)

    workflow_id = activity.info().workflow_id
    _, _, context = await _get_session(workflow_id)

    start = time.monotonic()
    page = await context.new_page()
    try:
        await page.goto(url, timeout=BROWSER_TIMEOUT_MS, wait_until="domcontentloaded")

        # Screenshot for UI streaming — saved to /tmp, never sent to LLM.
        # Also mirrored to the parent task_id so the UI receives updates from
        # all parallel sub-agents (child workflow IDs are "{task_id}-sub-{n}").
        try:
            screenshot_bytes = await page.screenshot(type="png", full_page=False)
            screenshot_path = _SCREENSHOT_DIR / f"{workflow_id}.png"
            screenshot_path.write_bytes(screenshot_bytes)
            # Mirror to root task_id when running inside a child workflow
            if "-sub-" in workflow_id:
                root_id = workflow_id.split("-sub-")[0]
                (_SCREENSHOT_DIR / f"{root_id}.png").write_bytes(screenshot_bytes)
        except Exception as ss_err:
            log.debug("screenshot_failed", error=str(ss_err))

        text = await page.inner_text("body")
        text = text.strip()[:15000]

        elapsed = time.monotonic() - start
        log.info("navigate_ok", elapsed_s=round(elapsed, 2), text_chars=len(text))
        return text if text else f"No readable content found at {url}"

    except Exception as e:
        log.warning("navigate_error", error=str(e))
        return f"Error navigating to {url}: {e}"


@activity.defn(name="close_browser")
async def close_browser() -> None:
    workflow_id = activity.info().workflow_id
    if workflow_id in _sessions:
        playwright, browser, _ = _sessions.pop(workflow_id)
        await browser.close()
        await playwright.stop()
        logger.info("browser_session_closed", workflow_id=workflow_id)


@activity.defn(name="click_element")
async def click_element(selector: str) -> bool:
    log = logger.bind(selector=selector)

    if USE_MOCK_BROWSER:
        log.info("click_element_mock")
        return True

    workflow_id = activity.info().workflow_id
    _, _, context = await _get_session(workflow_id)

    pages = context.pages
    if not pages:
        log.warning("click_no_page")
        return False

    page = pages[-1]
    try:
        await page.click(selector, timeout=BROWSER_TIMEOUT_MS)
        log.info("click_ok")
        return True
    except Exception:
        log.warning("click_not_found")
        return False
