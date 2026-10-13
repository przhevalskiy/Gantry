"""Phase D — role pack contract + oracle-a11y Temporal identity."""
from __future__ import annotations

from schemas.crew import CREW_AGENTS, FOREMAN_ACP_NAME, get_agent, workflow_names
from schemas.playbooks import KNOWN_CREW_ROLES, validate_playbook_config
from role_packs.registry import (
    PACK_ROLES,
    all_known_roles,
    load_pack_workflows,
    pack_catalog_entries,
    role_workflow_map,
)


def test_oracle_a11y_pack_registered():
    assert "oracle_a11y" in PACK_ROLES
    assert PACK_ROLES["oracle_a11y"]["workflow"] == "OracleA11yAgent"
    assert PACK_ROLES["oracle_a11y"]["pack"] == "oracle-a11y"
    assert "oracle_a11y" in all_known_roles()
    assert "oracle_a11y" in KNOWN_CREW_ROLES
    assert role_workflow_map()["oracle_a11y"] == "OracleA11yAgent"


def test_pack_catalog_is_temporal_child_same_acp():
    rows = pack_catalog_entries()
    assert any(r["workflow"] == "OracleA11yAgent" for r in rows)
    for row in rows:
        assert row["entrypoint"] == "temporal_child"
        assert row["acp_name"] == FOREMAN_ACP_NAME


def test_crew_catalog_includes_oracle_a11y():
    agent = get_agent("gantry-oracle-a11y")
    assert agent is not None
    assert agent["workflow"] == "OracleA11yAgent"
    assert agent["entrypoint"] == "temporal_child"
    assert agent["acp_name"] == "swarm-factory"
    assert "OracleA11yAgent" in workflow_names()
    assert sum(1 for a in CREW_AGENTS if a["entrypoint"] == "acp") == 1


def test_worker_loads_pack_workflows():
    classes = load_pack_workflows()
    names = {cls.__name__ for cls in classes}
    assert "OracleA11yAgent" in names
    from workflows.agents.oracle_a11y import OracleA11yAgent

    assert OracleA11yAgent in classes


def test_playbook_may_stage_oracle_a11y():
    validate_playbook_config({
        "tier_default": 2,
        "stages": [
            {"role": "architect"},
            {"role": "builder"},
            {"role": "oracle_a11y"},
        ],
        "artifact": {"type": "branch"},
    })


def test_oracle_a11y_agent_has_stable_workflow_defn():
    import re
    from pathlib import Path

    text = (Path(__file__).resolve().parents[1] / "workflows/agents/oracle_a11y.py").read_text()
    assert '@workflow.defn(name="OracleA11yAgent")' in text
    assert re.search(r"class OracleA11yAgent", text)
