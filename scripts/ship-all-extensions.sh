#!/usr/bin/env bash
# Build store zips for every micro extension present in apps/*/wxt.config.ts
# Order: firstWave from catalog, then remaining apps.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CATALOG="$ROOT/apps/store-kit/catalog.json"

mapfile -t FIRST < <(python3 - <<PY
import json
from pathlib import Path
c=json.loads(Path("$CATALOG").read_text())
print("\n".join(c.get("firstWave", [])))
PY
)

mapfile -t ALL < <(python3 - <<PY
import json
from pathlib import Path
c=json.loads(Path("$CATALOG").read_text())
print("\n".join(a["id"] for a in c["apps"]))
PY
)

declare -A SEEN
ORDER=()
for id in "${FIRST[@]}" "${ALL[@]}"; do
  [[ -z "$id" ]] && continue
  [[ -n "${SEEN[$id]:-}" ]] && continue
  SEEN["$id"]=1
  ORDER+=("$id")
done

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
