from __future__ import annotations
import os
from ._http import HttpClient
from .resources import Tasks, Projects, Agents

DEFAULT_BASE_URL = "https://api.gantry.dev"


class GantryClient:
    """Monolift API client.

    Usage::

        from gantry import GantryClient

        client = GantryClient(api_key="gantry_...")
        task = client.tasks.submit("Add rate limiting to the API", project_id="proj_abc")
        task = client.tasks.wait(task.task_id)
        print(task.pr_url)
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float = 30.0,
    ):
        key = api_key or os.environ.get("GANTRY_API_KEY")
        if not key:
            raise ValueError(
                "api_key is required. Pass it directly or set GANTRY_API_KEY env var."
            )
        url = base_url or os.environ.get("GANTRY_BASE_URL", DEFAULT_BASE_URL)
        http = HttpClient(base_url=url, api_key=key, timeout=timeout)
        self.tasks = Tasks(http)
        self.projects = Projects(http)
        self.agents = Agents(http)
