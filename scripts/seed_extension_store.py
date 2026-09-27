#!/usr/bin/env python3
"""Seed apps/<name>/store/ from apps/store-kit templates."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: seed_extension_store.py <app-id>")
        return 2

    app_id = sys.argv[1]
    root = Path(__file__).resolve().parents[1]
    catalog = json.loads((root / "apps/store-kit/catalog.json").read_text())
    overrides = json.loads((root / "apps/store-kit/app-overrides.json").read_text())
    templates = root / "apps/store-kit/templates"
    app = next((a for a in catalog["apps"] if a["id"] == app_id), None)
    if not app:
        print(f"Unknown app id: {app_id}")
        return 1

    app_dir = root / "apps" / app_id
    if not app_dir.is_dir():
        print(f"App directory not found: {app_dir}")
        print("Merge/checkout the extension PR branch first.")
        return 1

    o = overrides.get(app_id, {})
    bullets = o.get("bullets") or [
        "Core feature",
        "Fast local workflow",
        "Data stays on your device",
    ]
    while len(bullets) < 3:
        bullets.append("Local-first and privacy-conscious")

    vals = {
        "NAME": app["name"],
        "PITCH": app["pitch"],
        "PITCH_LOWER": app["pitch"][:1].lower() + app["pitch"][1:],
        "AUDIENCE": o.get("audience", "users"),
        "CORE_JOB": o.get("coreJob", app["pitch"]),
        "BULLET_1": bullets[0],
        "BULLET_2": bullets[1],
        "BULLET_3": bullets[2],
        "DATA_TYPES": o.get("dataTypes", "user content and settings"),
        "ACTIVE_TAB_USE": o.get("activeTabUse", "perform the user-initiated action"),
        "SCRIPTING_USE": o.get("scriptingUse", "apply the user-initiated change on the page"),
        "TABS_USE_OR_NA": o.get("tabsUse", "N/A"),
        "CONTEXT_MENUS_USE_OR_NA": o.get("contextMenusUse", "N/A"),
        "HOST_JUSTIFICATION": o.get(
            "hostJustification",
            "Host access is limited to what the feature requires.",
        ),
        "TEST_STEP_1": o.get("testStep1", "Open the popup and use the primary action."),
        "TEST_STEP_2": o.get("testStep2", "Confirm the result on the page."),
        "SUPPORT_EMAIL": "support@example.com",
        "HOMEPAGE_URL": f"https://example.com/{app_id}",
        "PRIVACY_POLICY_URL": f"https://example.com/privacy/{app_id}",
        "DATE": date.today().isoformat(),
        "GECKO_ID": app.get("geckoId", f"{app_id}@gantry.local"),
    }

    store = app_dir / "store"
    (store / "screenshots").mkdir(parents=True, exist_ok=True)

    for name in (
        "listing.md",
        "PRIVACY.md",
        "PERMISSIONS.md",
        "REVIEW_NOTES.md",
        "SCREENSHOTS.md",
    ):
        content = (templates / name).read_text()
        for key, value in vals.items():
            content = content.replace("{{" + key + "}}", value)
        (store / name).write_text(content)

    gecko = vals["GECKO_ID"]
    (store / "FIREFOX.md").write_text(
        f"""# Firefox notes — {vals["NAME"]}

Before AMO upload, set a unique gecko id in `wxt.config.ts`:

```ts
export default defineConfig({{
  modules: ['@wxt-dev/module-react'],
  manifest: {{
    // ...existing manifest fields
    browser_specific_settings: {{
      gecko: {{
        id: '{gecko}',
        strict_min_version: '109.0',
      }},
    }},
  }},
}});
```

Then:

```bash
./scripts/ship-extension.sh {app_id}
# upload apps/{app_id}/.output/store-ship/{app_id}-firefox.zip to AMO
```
"""
    )

    pkg_path = app_dir / "package.json"
    if pkg_path.exists():
        data = json.loads(pkg_path.read_text())
        scripts = data.setdefault("scripts", {})
        scripts.setdefault("dev", "wxt")
        scripts.setdefault("build", "wxt build")
        scripts.setdefault("zip", "wxt zip")
        scripts.setdefault("build:firefox", "wxt build -b firefox")
        scripts.setdefault("zip:firefox", "wxt zip -b firefox")
        scripts.setdefault("compile", "tsc --noEmit")
        scripts.setdefault("test", "vitest run")
        scripts.setdefault("postinstall", "wxt prepare")
        pkg_path.write_text(json.dumps(data, indent=2) + "\n")
        print("Updated package.json browser ship scripts")

    print(f"Seeded {store}")
    print("Next:")
    print("  1) Edit store/PRIVACY.md and publish to a public URL")
    print("  2) Fix SUPPORT_EMAIL / URLs in store/listing.md")
    print(f"  3) ./scripts/ship-extension.sh {app_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
