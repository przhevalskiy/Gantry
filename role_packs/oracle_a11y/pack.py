"""oracle-a11y role pack descriptor (Phase D)."""
from __future__ import annotations

PACK = {
    "id": "oracle-a11y",
    "label": "Accessibility oracle pack",
    "version": "1",
    "roles": [
        {
            "id": "oracle_a11y",
            "label": "Oracle A11y",
            "workflow": "OracleA11yAgent",
            "module": "workflows.agents.oracle_a11y",
            "class": "OracleA11yAgent",
            "catalog_name": "gantry-oracle-a11y",
            "level": "L4",
            "description": (
                "WCAG 2.1 AA oracle — runs allowlisted a11y lint/cli checks and returns "
                "structured findings. Composed by Foreman when a playbook stages this role."
            ),
            "tools": ["run_command", "read_file", "report_a11y"],
        },
    ],
}
