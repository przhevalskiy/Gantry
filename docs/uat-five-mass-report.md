# UAT / smoke — five mass extensions

Date: 2026-10-02  
Branch: `cursor/five-mass-extensions-cfb0`

## Automated

| Check | Result |
|-------|--------|
| Unit tests (all 5) | PASS |
| `tsc --noEmit` | PASS |
| `wxt build` + `wxt zip` | PASS |
| Manifest v3 + icons in zip | PASS |
| LinkWash URL clean logic | PASS |
| TabSleep idle rules | PASS |
| BannerAway reject labels | PASS |
| FeedKill `/shorts/` parse | PASS |

## Popup smoke (mocked browser APIs)

| App | Load | Interaction |
|-----|------|-------------|
| FeedKill | OK | Toggles visible |
| MediaBoost | OK | Sliders + enable control |
| LinkWash | OK | Clean & copy control |
| TabSleep | OK | Saved “UAT Session” (1 tab) |
| BannerAway | OK | Enable / Click Reject toggles |

Screenshots: `/opt/cursor/artifacts/screenshots/*-uat.png`

## Viability notes

- **FeedKill** — viable; narrow hosts; expect selector maintenance on YouTube/IG/X.
- **MediaBoost** — viable for HTML5; DRM/CORS can block boost (documented in UI).
- **LinkWash** — viable; copy intercept + context menu; search engines protected.
- **TabSleep** — viable via `tabs.discard` + alarms; session save/restore local.
- **BannerAway** — viable best-effort; CMP DOM churn is ongoing maintenance.

## CWS packages

`dist/cws-zips/*-1.0.0-chrome.zip` (also copied under `/opt/cursor/artifacts/`).
