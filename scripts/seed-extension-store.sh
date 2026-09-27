#!/usr/bin/env bash
# Seed apps/<name>/store/ metadata from store-kit templates + catalog overrides.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <app-id>"
  echo "Example: $0 replykit"
  exit 1
fi
exec python3 "$ROOT/scripts/seed_extension_store.py" "$NAME"
