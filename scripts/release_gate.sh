#!/usr/bin/env bash
# release_gate.sh — API-first invariant check-stop
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

echo "==> invariant: FE scaffold present (optional client)"
test -f apps/web/package.json
test -f apps/web/src/App.tsx
test -f docs/platform/frontend-structure.md
# Refuse bot-deploy landing copy in scaffold
if rg -n "Deploy your agent|bot marketplace" apps/web/src >/dev/null 2>&1; then
  echo "FAIL: forbidden bot-deploy copy in apps/web/src"
  exit 1
fi

echo "==> invariant: no Vercel UI deploy scripts"
test ! -f deploy/vercel-deploy.sh
test ! -f deploy/configure-ui-origin.sh

echo "==> invariant: docs index + core set present"
test -f docs/README.md
test -f docs/architecture.md
test -f docs/platform.md
test -f docs/use-cases.md
test -f docs/api.md
test -f docs/deep-dives/swarm-factory.md

echo "==> invariant: DEPLOYMENT stays API-primary (no Vercel SPA root)"
if rg -n "Root Directory.*apps/web|apps/web.*Vercel|Vercel.*apps/web" DEPLOYMENT.md >/dev/null 2>&1; then
  echo "FAIL: DEPLOYMENT.md still references Vercel UI root"
  exit 1
fi
rg -n "API \+ worker|no in-repo static UI|optional client" DEPLOYMENT.md >/dev/null

echo "==> CORS config tests"
.venv/bin/python -m pytest tests/test_cors_config.py -q

echo "==> release gate passed"
