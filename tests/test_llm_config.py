"""Per-org LLM BYOK configuration tests."""
import pytest

from api.repositories import org_settings as settings_repo
from api.repositories import secrets as secrets_repo
from api.repositories.organizations import DEFAULT_ORG_ID
from api.schemas.llm import LlmConfig
from api.services import llm_config as llm_config_service


@pytest.fixture
def isolated_gantry_home(tmp_path, monkeypatch):
    gantry_home = tmp_path / ".gantry"
    gantry_home.mkdir(parents=True)
    monkeypatch.setenv("GANTRY_HOME", str(gantry_home))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return gantry_home


@pytest.mark.asyncio
async def test_resolve_llm_params_from_org_secret(isolated_gantry_home):
    await secrets_repo.upsert_secret(org_id=DEFAULT_ORG_ID, name="anthropic-prod", value="sk-ant-test-key")
    await settings_repo.update_settings(
        DEFAULT_ORG_ID,
        llm_provider="anthropic",
        llm_api_key_secret="anthropic-prod",
        llm_sonnet_model="claude-sonnet-4-6",
    )

    params = await llm_config_service.resolve_llm_agentex_params(DEFAULT_ORG_ID)
    assert params["llm_anthropic_api_key"] == "sk-ant-test-key"
    assert params["llm_sonnet_model"] == "claude-sonnet-4-6"
    assert params["llm_provider"] == "anthropic"


@pytest.mark.asyncio
async def test_task_llm_overrides_org_default(isolated_gantry_home):
    await secrets_repo.upsert_secret(org_id=DEFAULT_ORG_ID, name="openai-key", value="sk-openai-test")
    await settings_repo.update_settings(
        DEFAULT_ORG_ID,
        llm_provider="anthropic",
        llm_api_key_secret="anthropic-prod",
    )
    await secrets_repo.upsert_secret(org_id=DEFAULT_ORG_ID, name="anthropic-prod", value="sk-ant-org")

    params = await llm_config_service.resolve_llm_agentex_params(
        DEFAULT_ORG_ID,
        LlmConfig(provider="openai", api_key_secret="openai-key", sonnet_model="gpt-4o"),
    )
    assert params["llm_openai_api_key"] == "sk-openai-test"
    assert params["llm_sonnet_model"] == "gpt-4o"


def test_extract_agentex_llm_params():
    from project.llm_runtime import extract_agentex_llm_params, model_for_tier

    raw = {
        "llm_anthropic_api_key": "sk-ant",
        "llm_sonnet_model": "claude-sonnet-4-6",
        "llm_haiku_model": "claude-haiku-4-5-20251001",
    }
    creds = extract_agentex_llm_params(raw)
    assert creds["anthropic_api_key"] == "sk-ant"
    assert model_for_tier(0, creds) == "claude-haiku-4-5-20251001"
    assert model_for_tier(3, creds) == "claude-sonnet-4-6"
