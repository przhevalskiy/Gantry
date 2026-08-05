"""Phase 3 platform tests — pipeline config, integrations, white-label."""
import pytest

from api.repositories import projects as projects_repo
from api.repositories.organizations import DEFAULT_ORG_ID
from api.schemas.pipeline import PipelineConfig


@pytest.fixture
def isolated_gantry_home(tmp_path, monkeypatch):
    gantry_home = tmp_path / ".gantry"
    projects_base = gantry_home / "projects"
    projects_base.mkdir(parents=True)
    monkeypatch.setenv("GANTRY_HOME", str(gantry_home))
    monkeypatch.setenv("GANTRY_FILES_BASE", str(projects_base))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return gantry_home


def test_pipeline_config_to_agentex_params():
    cfg = PipelineConfig(
        tier=2,
        max_parallel_tracks=4,
        max_heal_cycles=2,
        lightweight_mode=True,
        disable_agents=["reviewer", "security"],
    )
    params = cfg.to_agentex_params()
    assert params["tier"] == 2
    assert params["max_parallel_tracks"] == 4
    assert params["max_heal_cycles"] == 2
    assert params["lightweight_mode"] is True
    assert set(params["disable_agents"]) == {"reviewer", "security"}


def test_pipeline_config_rejects_invalid_agents():
    with pytest.raises(ValueError, match="invalid disable_agents"):
        PipelineConfig(disable_agents=["architect"]).to_agentex_params()


@pytest.mark.asyncio
async def test_find_project_by_linear_team(isolated_gantry_home):
    await projects_repo.create_project(
        "Linear App",
        org_id=DEFAULT_ORG_ID,
        linear_team_id="team_abc123",
    )
    found = await projects_repo.find_by_linear_team("team_abc123")
    assert found is not None
    assert found["linear_team_id"] == "team_abc123"


@pytest.mark.asyncio
async def test_find_project_by_jira_key(isolated_gantry_home):
    await projects_repo.create_project(
        "Jira App",
        org_id=DEFAULT_ORG_ID,
        jira_project_key="eng",
    )
    found = await projects_repo.find_by_jira_key("ENG")
    assert found is not None
    assert found["jira_project_key"] == "ENG"


@pytest.mark.asyncio
async def test_org_settings_defaults_without_db(isolated_gantry_home):
    from api.repositories import org_settings as settings_repo

    settings = await settings_repo.get_settings(DEFAULT_ORG_ID)
    assert settings["brand_name"] == "Gantry"
    assert settings["accent_color"] == "#f97316"


def test_resolve_pipeline_params():
    from api.routes.tasks import _resolve_pipeline_params

    tier, params = _resolve_pipeline_params(-1, None)
    assert tier == -1
    assert params == {}

    tier, params = _resolve_pipeline_params(-1, PipelineConfig(tier=1, disable_agents=["pm"]))
    assert tier == 1
    assert "tier" not in params
    assert params["disable_agents"] == ["pm"]
