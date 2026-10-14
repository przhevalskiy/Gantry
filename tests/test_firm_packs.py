"""Phase E — firm packs catalog, install, playbooks.run resolution."""
from __future__ import annotations

import pytest

from schemas.firm_packs import (
    FIRM_PACKS,
    get_pack,
    list_pack_catalog,
    pack_ref,
    parse_pack_ref,
    playbook_to_pack,
    resolve_run_playbook,
)


def test_catalog_has_swe_and_migration():
    ids = {p["id"] for p in list_pack_catalog()}
    assert ids == {"swe-factory", "migration-runner"}
    assert get_pack("swe-factory")["ref"] == "swe-factory@1"
    assert get_pack("migration-runner")["default_playbook"] == "a11y-remediation"
    assert "oracle_a11y" in get_pack("migration-runner")["roles"]
    assert FIRM_PACKS["swe-factory"]["auto_enabled"] is True


def test_pack_ref_parse():
    assert parse_pack_ref("swe-factory@1") == ("swe-factory", "1")
    assert parse_pack_ref("Migration-Runner") == ("migration-runner", None)
    assert pack_ref("swe-factory") == "swe-factory@1"
    with pytest.raises(ValueError):
        get_pack("swe-factory", "99")


def test_playbook_to_pack_and_run_resolve():
    assert playbook_to_pack("a11y-remediation") == "migration-runner"
    assert playbook_to_pack("platform-backlog") == "swe-factory"
    assert playbook_to_pack("custom-org-skill") is None

    assert resolve_run_playbook(pack="swe-factory@1", playbook=None) == (
        "swe-factory",
        "platform-backlog",
    )
    assert resolve_run_playbook(pack=None, playbook="monorepo-slice") == (
        "swe-factory",
        "monorepo-slice",
    )
    assert resolve_run_playbook(pack="migration-runner", playbook="a11y-remediation") == (
        "migration-runner",
        "a11y-remediation",
    )
    with pytest.raises(ValueError, match="belongs to pack"):
        resolve_run_playbook(pack="swe-factory", playbook="a11y-remediation")
    with pytest.raises(ValueError, match="required"):
        resolve_run_playbook(pack=None, playbook=None)


@pytest.mark.asyncio
async def test_org_pack_install_file_fallback(tmp_path, monkeypatch):
    monkeypatch.setenv("GANTRY_HOME", str(tmp_path / ".gantry"))
    monkeypatch.delenv("DATABASE_URL", raising=False)

    from api.repositories import firm_packs as packs_repo

    org = "00000000-0000-4000-8000-000000000001"
    catalog = await packs_repo.list_org_packs(org_id=org)
    by_id = {p["pack_id"]: p for p in catalog}
    assert by_id["swe-factory"]["enabled"] is True
    assert by_id["swe-factory"]["installed"] is False
    assert by_id["migration-runner"]["installed"] is False

    installed = await packs_repo.install_pack(org_id=org, pack_id="migration-runner", max_tasks_per_day=50)
    assert installed["installed"] is True
    assert installed["enabled"] is True
    assert installed["max_tasks_per_day"] == 50

    disabled = await packs_repo.update_pack(org_id=org, pack_id="migration-runner", enabled=False)
    assert disabled["enabled"] is False

    with pytest.raises(ValueError, match="disabled"):
        await packs_repo.assert_playbook_pack_allowed(
            org_id=org,
            playbook_slug="a11y-remediation",
        )

    await packs_repo.update_pack(org_id=org, pack_id="migration-runner", enabled=True)
    assert (
        await packs_repo.assert_playbook_pack_allowed(
            org_id=org,
            playbook_slug="a11y-remediation",
        )
        == "migration-runner"
    )


def test_sdk_exposes_playbooks_and_packs():
    import sys
    from pathlib import Path

    sdk_root = Path(__file__).resolve().parents[1] / "sdk" / "python"
    sys.path.insert(0, str(sdk_root))
    from gantry.resources import Packs, Playbooks
    from gantry.client import GantryClient

    assert hasattr(Playbooks, "run")
    assert hasattr(Packs, "install")
    client = GantryClient(api_key="gantry_test", base_url="http://localhost:8001")
    assert isinstance(client.playbooks, Playbooks)
    assert isinstance(client.packs, Packs)


def test_ts_sdk_wires_playbooks_run():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    index = (root / "sdk/typescript/src/index.ts").read_text()
    resources = (root / "sdk/typescript/src/resources.ts").read_text()
    assert "readonly playbooks: Playbooks" in index
    assert "readonly packs: Packs" in index
    assert "async run(options:" in resources
    assert "/v1/playbooks/run" in resources
