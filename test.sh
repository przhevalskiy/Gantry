#!/usr/bin/env bash
# Run the test suite.
#
# Usage:
#   ./test.sh                        Run all unit tests
#   ./test.sh --smoke                Run API smoke tests against localhost:8001
#   ./test.sh --smoke --prod         Run API smoke tests against api.monolift.dev
#   ./test.sh tests/test_planner.py  Run a specific file
#   ./test.sh -k test_extract        Run tests matching a keyword
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [ ! -d .venv ]; then
  echo "ERROR: .venv not found. Run ./setup.sh first."
  exit 1
fi

export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-test-key}"
export TAVILY_API_KEY="${TAVILY_API_KEY:-test-key}"
export AGENT_NAME="${AGENT_NAME:-web-scout}"
export ACP_URL="${ACP_URL:-http://localhost:8000}"
export WORKFLOW_NAME="${WORKFLOW_NAME:-web-scout}"
export WORKFLOW_TASK_QUEUE="${WORKFLOW_TASK_QUEUE:-web_scout_queue}"

SMOKE=0
PROD=0
ARGS=("")

for arg in "$@"; do
  case "$arg" in
    --smoke) SMOKE=1 ;;
    --prod)  PROD=1 ;;
    *)       ARGS+=("$arg") ;;
  esac
done

if [ "$SMOKE" = "1" ]; then
  if [ "$PROD" = "1" ]; then
    export GANTRY_API_URL="${GANTRY_API_URL:-https://api.monolift.dev}"
    echo "==> Smoke tests → $GANTRY_API_URL"
  else
    export GANTRY_API_URL="${GANTRY_API_URL:-http://localhost:8001}"
    echo "==> Smoke tests → $GANTRY_API_URL"
    if ! curl -sf "$GANTRY_API_URL/health" > /dev/null 2>&1; then
      echo "ERROR: Gantry API not reachable at $GANTRY_API_URL. Run ./dev.sh first."
      exit 1
    fi
  fi
  echo "==> Running API smoke tests..."
  .venv/bin/python -m pytest tests/test_api_smoke.py -v "${ARGS[@]}"
  exit $?
fi

echo "==> Running unit tests..."
.venv/bin/python -m pytest --ignore=tests/test_api_smoke.py "${ARGS[@]}"
