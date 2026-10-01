# Mass-use POCs (3 prototypes)

Branch: `cursor/mass-use-pocs-cfb0`

These are **proofs of concept** for consumer mass-use lanes — separate from the agency top-10 portfolio.

| App | Path | Lane | What it does |
|-----|------|------|----------------|
| **PriceTrack** | `apps/pricetrack` | Shopping | Extract price on tab, local history, coupon **note** only (no inject) |
| **TrackerGlance** | `apps/trackerglance` | Privacy | Read-only known-tracker scan |
| **PageSum** | `apps/pagesum` | AI | Summarize tab with user-supplied API key |

## Run

```bash
for id in pricetrack trackerglance pagesum; do
  (cd apps/$id && npm install && npm test && npm run compile && npm run build)
done
```

## Review / ops honesty

- All three use broad `host_permissions` for “any page” mass use — harder CWS review than the agency ten.
- PriceTrack deliberately **avoids coupon auto-injection**.
- TrackerGlance does **not** block trackers (safer claims).
- PageSum pushes **API cost to the user** (their key) so the POC isn’t burning your tokens.

## Not a replacement for the top 10

Agency switchers remain the leave-alone / easy-review portfolio. These POCs explore mass acquisition.
