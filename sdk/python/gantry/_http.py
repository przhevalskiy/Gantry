from __future__ import annotations
import json
import httpx
from typing import Any, Iterator


class HttpClient:
    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0):
        self._base = base_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        self._timeout = timeout

    def _url(self, path: str) -> str:
        return f"{self._base}{path}"

    def get(self, path: str, **kwargs: Any) -> dict:
        with httpx.Client(timeout=self._timeout) as c:
            r = c.get(self._url(path), headers=self._headers, **kwargs)
            r.raise_for_status()
            return r.json()

    def post(self, path: str, json: dict | None = None, **kwargs: Any) -> dict:
        with httpx.Client(timeout=self._timeout) as c:
            r = c.post(self._url(path), headers=self._headers, json=json or {}, **kwargs)
            r.raise_for_status()
            return r.json()

    def patch(self, path: str, json: dict | None = None, **kwargs: Any) -> dict:
        with httpx.Client(timeout=self._timeout) as c:
            r = c.patch(self._url(path), headers=self._headers, json=json or {}, **kwargs)
            r.raise_for_status()
            return r.json()

    def delete(self, path: str, **kwargs: Any) -> None:
        with httpx.Client(timeout=self._timeout) as c:
            r = c.delete(self._url(path), headers=self._headers, **kwargs)
            r.raise_for_status()

    def stream_sse(self, path: str, **kwargs: Any) -> Iterator[dict]:
        """Yield parsed SSE `data:` JSON payloads from a GET stream."""
        headers = {**self._headers, "Accept": "text/event-stream", **kwargs.pop("headers", {})}
        with httpx.Client(timeout=None) as c:
            with c.stream("GET", self._url(path), headers=headers, **kwargs) as r:
                r.raise_for_status()
                buffer = ""
                for chunk in r.iter_text():
                    buffer += chunk
                    while "\n\n" in buffer:
                        frame, buffer = buffer.split("\n\n", 1)
                        for line in frame.split("\n"):
                            if line.startswith("data: "):
                                yield json.loads(line[6:])
                                break
