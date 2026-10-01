# Mass-use portfolio (primary)

Branch: `cursor/mass-use-pocs-cfb0`

These three consumer extensions are the **active product bet**. Agency switchers (ShopSwitch, ClientMark, etc.) are niche ops tools for a tiny buyer set — parked in [agency-extension-hub](https://github.com/przhevalskiy/agency-extension-hub), not the download path.

| App | Path | Lane | Why mass | v0.2 |
|-----|------|------|----------|------|
| **PriceTrack** | `apps/pricetrack` | Shopping | Everyone shops; local history + target price, no Honey-style inject | Sparkline, low/high, target price |
| **TrackerGlance** | `apps/trackerglance` | Privacy | Curiosity on every site; read-only = safer claims than blockers | Auto-scan, ~30 trackers, privacy score |
| **PageSum** | `apps/pagesum` | AI | Summarize any tab; BYOK so you don’t eat API cost | Bullets / short / simple, copy |

## Run / verify

```bash
for id in pricetrack trackerglance pagesum; do
  (cd apps/$id && npm install && npm test && npm run compile && npm run build)
done
```

## Store / ops

- Broad `host_permissions` (any page) → harder CWS review than narrow-host agency tools. Worth it for mass install.
- PriceTrack: **no coupon auto-injection**.
- TrackerGlance: **does not block** trackers (glance + score only).
- PageSum: user pays their own model API; key in `chrome.storage.local`.
- Pricing (locked earlier): Pro **$3.99/mo** or **$29/yr** per app, no suite, no in-app ads.
- Ship order: Chrome → Edge → Firefox; submit one lane at a time (PriceTrack first).

## Ship priority

1. **PriceTrack** — clearest consumer habit loop (watch → recheck → drop).
2. **TrackerGlance** — zero API cost, instant “wow” on news/shopping sites.
3. **PageSum** — requires user API key; smaller install funnel, still real demand.

## Not doing

- Building more agency “wrong-client” switchers.
- Coupon injection, tracker blocking, or hosted AI that bills you per summarize.
