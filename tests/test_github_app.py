"""GitHub App installation and token resolution tests."""
import pytest

from api.repositories import github_installations as installations_repo
from api.repositories.organizations import DEFAULT_ORG_ID
from api.services import github_install_state


@pytest.fixture
def isolated_gantry_home(tmp_path, monkeypatch):
    gantry_home = tmp_path / ".gantry"
    gantry_home.mkdir(parents=True)
    monkeypatch.setenv("GANTRY_HOME", str(gantry_home))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return gantry_home


def test_install_state_roundtrip():
    state = github_install_state.sign_org_state(DEFAULT_ORG_ID)
    assert github_install_state.verify_org_state(state) == DEFAULT_ORG_ID
    assert github_install_state.verify_org_state("bad.state") is None


@pytest.mark.asyncio
async def test_installation_covers_all_repos(isolated_gantry_home):
    await installations_repo.upsert_installation(
        installation_id=12345,
        org_id=DEFAULT_ORG_ID,
        account_login="acme",
        account_type="Organization",
        repository_selection="all",
    )
    found = await installations_repo.find_for_repo(DEFAULT_ORG_ID, "acme", "payments")
    assert found is not None
    assert found["installation_id"] == 12345


@pytest.mark.asyncio
async def test_installation_selected_repos_only(isolated_gantry_home):
    await installations_repo.upsert_installation(
        installation_id=999,
        org_id=DEFAULT_ORG_ID,
        account_login="acme",
        repository_selection="selected",
        repos=[{"owner": "acme", "name": "api"}],
    )
    assert await installations_repo.find_for_repo(DEFAULT_ORG_ID, "acme", "api") is not None
    assert await installations_repo.find_for_repo(DEFAULT_ORG_ID, "acme", "other") is None


@pytest.mark.asyncio
async def test_add_and_remove_repositories(isolated_gantry_home):
    await installations_repo.upsert_installation(
        installation_id=555,
        org_id=DEFAULT_ORG_ID,
        account_login="acme",
        repos=[{"owner": "acme", "name": "web"}],
    )
    await installations_repo.add_repositories(
        555, [{"owner": "acme", "name": "api"}]
    )
    record = await installations_repo.get_installation(555)
    assert len(record["repos"]) == 2

    await installations_repo.remove_repositories(
        555, [{"owner": "acme", "name": "web"}]
    )
    record = await installations_repo.get_installation(555)
    assert len(record["repos"]) == 1
    assert record["repos"][0]["name"] == "api"
