#!/usr/bin/env bash
# Build store zips for every micro extension present in apps/*/wxt.config.ts
# Order: firstWave from catalog, then remaining apps.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CATALOG="$ROOT/apps/store-kit/catalog.json"

# Only active portfolio (top 5). Deferred apps are skipped on purpose.
mapfile -t ORDER < <(python3 - <<PY
import json
from pathlib import Path
c=json.loads(Path("$CATALOG").read_text())
active=c.get("activeWave") or [a["id"] for a in c["apps"] if a.get("status")=="active"]
first=c.get("firstWave") or []
# firstWave first, then remaining active
seen=set()
order=[]
for i in first + active:
    if i in seen: continue
    if i not in active: continue
    seen.add(i)
    order.append(i)
print("\n".join(order))
PY
)

failed=()
built=()
skipped=()

for id in "${ORDER[@]}"; do
  if [[ ! -f "$ROOT/apps/$id/wxt.config.ts" ]]; then
    echo "SKIP $id (app not present on this branch)"
    skipped+=("$id")
    continue
  fi
  echo "######## Shipping $id ########"
  if "$ROOT/scripts/ship-extension.sh" "$id"; then
    built+=("$id")
  else
    failed+=("$id")
  fi
done

echo
echo "Built:   ${built[*]:-none}"
echo "Skipped: ${skipped[*]:-none}"
echo "Failed:  ${failed[*]:-none}"
[[ ${#failed[@]} -eq 0 ]]
