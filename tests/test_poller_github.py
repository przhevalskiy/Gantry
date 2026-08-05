"""Poller GitHub issue callback tests."""
import pytest
from unittest.mock import AsyncMock, patch

from api.services.poller import _handle_github_callback


@pytest.mark.asyncio
async def test_github_callback_posts_pr_link_with_token():
    meta = {
        "org_id": "00000000-0000-4000-8000-000000000001",
        "project_id": "proj-1",
        "github_owner": "acme",
        "github_repo": "api",
        "github_issue_number": 42,
        "source": "github_issues",
    }

    with patch("api.services.poller.projects_repo.get_project", new_callable=AsyncMock) as mock_project:
        with patch("api.services.poller.github_tokens.resolve_token", new_callable=AsyncMock) as mock_token:
            with patch("api.services.poller.github_client.post_issue_comment", new_callable=AsyncMock) as mock_comment:
                mock_project.return_value = {"id": "proj-1", "github_owner": "acme", "github_repo": "api"}
                mock_token.return_value = "ghs_installation_token"

                await _handle_github_callback(
                    "task_abc",
                    meta,
                    "completed",
                    "https://github.com/acme/api/pull/99",
                )

                mock_comment.assert_awaited_once()
                call_kwargs = mock_comment.await_args.kwargs
                assert call_kwargs["token"] == "ghs_installation_token"
                assert "pull/99" in call_kwargs["body"]
                assert call_kwargs["issue_number"] == 42
