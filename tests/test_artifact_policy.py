"""Phase B — artifact policy helpers and structured results."""
from __future__ import annotations

from workflows.swarm.completion import structured_result_from_devops


def test_structured_result_includes_artifact_type_pr():
    result = structured_result_from_devops(
        {"pr_url": "https://github.com/a/b/pull/1", "branch": "swarm/x", "artifact_type": "pr"},
        branch="swarm/x",
    )
    assert result["artifact_type"] == "pr"
    assert result["pr_url"].endswith("/pull/1")
    assert result["branch"] == "swarm/x"


def test_structured_result_branch_omits_pr():
    result = structured_result_from_devops(
        {"pr_url": "https://github.com/a/b/pull/1", "branch": "a11y/x", "artifact_type": "branch"},
        branch="a11y/x",
        artifact_type="branch",
    )
    assert result["artifact_type"] == "branch"
    assert "pr_url" not in result
    assert result["branch"] == "a11y/x"


def test_structured_result_report_omits_git_publish():
    result = structured_result_from_devops(
        {"branch": "ignored", "artifact_type": "report"},
        branch="ignored",
        artifact_type="report",
    )
    assert result["artifact_type"] == "report"
    assert "pr_url" not in result
    assert "branch" not in result
