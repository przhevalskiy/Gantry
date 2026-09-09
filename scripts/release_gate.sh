#!/usr/bin/env bash
# release_gate.sh — master check-stop from docs/platform/platform-merge-plan.md §7
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> pytest merge subset"
.venv/bin/python -m pytest \
  tests/test_track_conflicts.py \
  tests/test_orchestrator_guards.py \
  tests/test_agentex_citizen.py \
  tests/test_horizontal_contract.py \
  tests/test_task_sse_contract.py \
  tests/test_bulk_isolation.py \
  tests/test_playbooks.py \
  tests/test_playbook_verticals.py \
  tests/test_task_meta_patch.py \
  tests/test_a11y_oracle_fixture.py \
  tests/test_platform_phase0.py \
  -v

echo "==> invariant: no task/create in workflows/"
if rg "task/create" workflows/ >/dev/null 2>&1; then
  echo "FAIL: task/create found in workflows/"
  exit 1
fi

echo "==> invariant: no Qodex domain strings in apps/api/workflows"
if rg -i "hive_api|ga4_property|show_checklist" apps/ api/ workflows/ >/dev/null 2>&1; then
  echo "FAIL: Qodex domain strings found"
  exit 1
fi

echo "==> invariant: acp_type async in manifest"
rg "acp_type: async" manifest.yaml project/acp.py >/dev/null

echo "==> invariant: Helm agent name"
rg "agentName: swarm-factory" deploy/helm/gantry/values.yaml >/dev/null

echo "==> invariant: legacy ui/ removed"
test ! -d ui

echo "==> invariant: DEPLOYMENT points to apps/web"
rg "Root Directory.*apps/web" DEPLOYMENT.md >/dev/null || rg "root \`apps/web\`" DEPLOYMENT.md >/dev/null

echo "==> invariant: M1 clean in apps/web/src"
if rg -i "hive_api|ga4_property|show_checklist|marcomms|web_services|media_outreach|press release request" apps/web/src >/dev/null 2>&1; then
  echo "FAIL: Qodex domain strings found in apps/web/src"
  exit 1
fi

echo "==> invariant: no legacy Qodex backend URLs in apps/web/src"
if rg "localhost:8000|/api/chat" apps/web/src >/dev/null 2>&1; then
  echo "FAIL: legacy Qodex backend references in apps/web/src"
  exit 1
fi

echo "==> apps/web production build"
(cd apps/web && npm run build)

echo "==> release gate passed"
