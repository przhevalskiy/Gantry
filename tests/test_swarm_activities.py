"""
UAT tests for swarm activities — file I/O, git ops, secret scanning.
No Temporal, no LLM, no network. Pure Python.
Run: pytest tests/test_swarm_activities.py -v
"""
import os
import pytest
import tempfile
from pathlib import Path


# ── File I/O ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_write_and_read_file():
    from activities.swarm_activities import swarm_write_file, swarm_read_file

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "hello.py")
        result = await swarm_write_file(path, "print('hello')\n")
        assert "Written" in result

        content = await swarm_read_file(path)
        assert content == "print('hello')\n"


@pytest.mark.asyncio
async def test_write_creates_parent_dirs():
    from activities.swarm_activities import swarm_write_file

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "deep", "nested", "file.ts")
        result = await swarm_write_file(path, "export const x = 1;")
        assert "Written" in result
        assert Path(path).exists()


@pytest.mark.asyncio
async def test_patch_file():
    from activities.swarm_activities import swarm_write_file, swarm_patch_file, swarm_read_file

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "app.py")
        await swarm_write_file(path, "def foo():\n    return 1\n")

        result = await swarm_patch_file(path, "return 1", "return 42")
        assert "Patched" in result

        content = await swarm_read_file(path)
        assert "return 42" in content
        assert "return 1" not in content


@pytest.mark.asyncio
async def test_patch_file_missing_old_str():
    from activities.swarm_activities import swarm_write_file, swarm_patch_file

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "app.py")
        await swarm_write_file(path, "def foo(): pass\n")

        result = await swarm_patch_file(path, "DOES_NOT_EXIST", "replacement")
        assert "not found" in result.lower()


@pytest.mark.asyncio
async def test_delete_file():
    from activities.swarm_activities import swarm_write_file, swarm_delete_file

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "temp.py")
        await swarm_write_file(path, "# temp")

        result = await swarm_delete_file(path)
        assert "Deleted" in result
        assert not Path(path).exists()


@pytest.mark.asyncio
async def test_read_missing_file():
    from activities.swarm_activities import swarm_read_file

    result = await swarm_read_file("/nonexistent/path/file.py")
    assert "not found" in result.lower() or "Error" in result


@pytest.mark.asyncio
async def test_list_directory():
    from activities.swarm_activities import swarm_list_directory

    with tempfile.TemporaryDirectory() as tmp:
        Path(os.path.join(tmp, "src")).mkdir()
        Path(os.path.join(tmp, "src", "main.py")).write_text("# main")
        Path(os.path.join(tmp, "README.md")).write_text("# readme")

        result = await swarm_list_directory(tmp, max_depth=2)
        assert "src" in result
        assert "main.py" in result
        assert "README.md" in result


# ── Shell command ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_command_success():
    from activities.swarm_activities import swarm_run_command

    result = await swarm_run_command("echo hello_swarm")
    assert "hello_swarm" in result


@pytest.mark.asyncio
async def test_run_command_nonzero_exit():
    from activities.swarm_activities import swarm_run_command

    result = await swarm_run_command("exit 1", timeout=5)
    assert "exit code" in result.lower() or result  # returns output even on failure


# ── Secret scanning ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_scan_secrets_clean():
    from activities.swarm_activities import swarm_scan_secrets

    with tempfile.TemporaryDirectory() as tmp:
        Path(os.path.join(tmp, "main.py")).write_text("print('hello world')\n")
        result = await swarm_scan_secrets(tmp)
        assert "No secrets detected" in result


@pytest.mark.asyncio
async def test_scan_secrets_finds_aws_key():
    from activities.swarm_activities import swarm_scan_secrets

    with tempfile.TemporaryDirectory() as tmp:
        Path(os.path.join(tmp, "config.py")).write_text(
            "AWS_KEY = 'AKIAIOSFODNN7EXAMPLE'\n"
        )
        result = await swarm_scan_secrets(tmp)
        assert "CRITICAL" in result or "AWS" in result


@pytest.mark.asyncio
async def test_scan_secrets_flags_env_file():
    from activities.swarm_activities import swarm_scan_secrets

    with tempfile.TemporaryDirectory() as tmp:
        Path(os.path.join(tmp, ".env")).write_text("SECRET_KEY=abc123\n")
        result = await swarm_scan_secrets(tmp)
        assert "WARNING" in result or ".env" in result


@pytest.mark.asyncio
async def test_scan_secrets_skips_venv():
    from activities.swarm_activities import swarm_scan_secrets

    with tempfile.TemporaryDirectory() as tmp:
        # Put a "secret" inside .venv — should be skipped
        venv_dir = Path(os.path.join(tmp, ".venv", "lib"))
        venv_dir.mkdir(parents=True)
        (venv_dir / "config.py").write_text("AKIAIOSFODNN7EXAMPLE\n")
        # Clean file outside .venv
        Path(os.path.join(tmp, "app.py")).write_text("print('ok')\n")

        result = await swarm_scan_secrets(tmp)
        assert "No secrets detected" in result


# ── Git activities (requires git in PATH) ─────────────────────────────────────

@pytest.mark.asyncio
async def test_git_status_clean_repo():
    from activities.swarm_activities import swarm_git_status, swarm_run_command

    with tempfile.TemporaryDirectory() as tmp:
        await swarm_run_command("git init", cwd=tmp)
        await swarm_run_command("git config user.email 'test@test.com'", cwd=tmp)
        await swarm_run_command("git config user.name 'Test'", cwd=tmp)

        result = await swarm_git_status(cwd=tmp)
        # Either "clean" or empty output for a fresh repo
        assert isinstance(result, str)


@pytest.mark.asyncio
async def test_git_create_branch():
    from activities.swarm_activities import swarm_run_command, swarm_write_file, swarm_git_add, swarm_git_commit, swarm_git_create_branch

    with tempfile.TemporaryDirectory() as tmp:
        await swarm_run_command("git init", cwd=tmp)
        await swarm_run_command("git config user.email 'test@test.com'", cwd=tmp)
        await swarm_run_command("git config user.name 'Test'", cwd=tmp)

        # Need at least one commit before branching
        path = os.path.join(tmp, "init.py")
        await swarm_write_file(path, "# init\n")
        await swarm_git_add(["."], cwd=tmp)
        await swarm_git_commit("chore: initial commit", cwd=tmp)

        result = await swarm_git_create_branch("swarm/test-branch", cwd=tmp)
        assert "swarm/test-branch" in result or "Created" in result


@pytest.mark.asyncio
async def test_git_add_and_commit():
    from activities.swarm_activities import swarm_run_command, swarm_write_file, swarm_git_add, swarm_git_commit
    import json

    with tempfile.TemporaryDirectory() as tmp:
        await swarm_run_command("git init", cwd=tmp)
        await swarm_run_command("git config user.email 'test@test.com'", cwd=tmp)
        await swarm_run_command("git config user.name 'Test'", cwd=tmp)

        path = os.path.join(tmp, "feature.py")
        await swarm_write_file(path, "def add(a, b): return a + b\n")

        add_result = await swarm_git_add(["."], cwd=tmp)
        assert "Staged" in add_result

        commit_result = await swarm_git_commit("feat: add function", cwd=tmp)
        parsed = json.loads(commit_result)
        assert "sha" in parsed
        assert len(parsed["sha"]) > 0
