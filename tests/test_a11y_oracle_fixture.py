"""P5.3 — a11y oracle fixture: violations detected before fix, clean after heal."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from project.schema.playbooks import playbook_oracle_qa_commands

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "a11y-violation"
VIOLATION_FILE = FIXTURE / "src" / "BadButton.tsx"
FIXED_CONTENT = 'export function BadButton() {\n  return <img src="/logo.png" alt="Logo" />;\n}\n'


def _run_a11y_oracle(repo: Path) -> subprocess.CompletedProcess[str]:
    cmd = playbook_oracle_qa_commands("a11y-remediation").get("a11y", "")
    assert cmd, "a11y playbook must define qa_commands.a11y"
    return subprocess.run(
        cmd,
        shell=True,
        cwd=repo,
        capture_output=True,
        text=True,
    )


@pytest.fixture
def a11y_repo(tmp_path):
    dest = tmp_path / "repo"
    shutil.copytree(FIXTURE, dest)
    subprocess.run(["npm", "install", "--silent"], cwd=dest, check=True, capture_output=True)
    return dest


def test_a11y_oracle_fails_on_violation(a11y_repo):
    result = _run_a11y_oracle(a11y_repo)
    assert result.returncode != 0 or "alt-text" in (result.stdout + result.stderr).lower()


def test_a11y_oracle_passes_after_heal(a11y_repo):
    (a11y_repo / "src" / "BadButton.tsx").write_text(FIXED_CONTENT)
    result = _run_a11y_oracle(a11y_repo)
    assert result.returncode == 0, result.stdout + result.stderr
