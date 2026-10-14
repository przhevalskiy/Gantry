#!/usr/bin/env bash
# First-time setup: create venv, install deps, copy .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Checking prerequisites..."
command -v uv >/dev/null 2>&1 || { echo "ERROR: uv not found. Install from https://docs.astral.sh/uv/"; exit 1; }
command -v agentex >/dev/null 2>&1 || { echo "ERROR: agentex CLI not found. Install with: uv tool install agentex-sdk"; exit 1; }

echo "==> Creating virtual environment..."
uv venv

echo "==> Installing dependencies..."
uv sync --extra dev

echo "==> Setting up .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env from .env.example — fill in ANTHROPIC_API_KEY (and optional BRAVE_SEARCH_API_KEY)."
else
  echo "    .env already exists — skipping."
fi

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit .env and add your API keys"
echo "  2. ./dev.sh            (Temporal + worker + API :8001)"
echo "  3. ./test.sh           (run the test suite)"
echo ""
echo "Web search uses Brave if BRAVE_SEARCH_API_KEY is set, else DuckDuckGo."
echo "Docs: docs/README.md — Agentex: docs/platform/agentex-cluster.md"
