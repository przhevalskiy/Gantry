# Cursor agent handoff — top 10 agency Chrome extensions

**Read this first** if you are a Cursor cloud/desktop agent continuing this project in a new session.

**Repo:** `przhevalskiy/Gantry`  
**Branch (source of truth for the 10 apps):** `cursor/top-ten-agency-extensions-cfb0`  
**PR:** https://github.com/przhevalskiy/Gantry/pull/7  
**Base branch:** `main`  
**Owner intent:** ship review-safe, low-maintenance, per-app paid micro extensions for agencies (wrong-client / wrong-workspace pain). Local-only v1. No ads in apps.

---

## Mission (locked decisions)

1. **Portfolio = exactly these 10** (narrow hosts, easy Chrome/Edge/AMO review):
   - ShopSwitch, HelpdeskHop, KlaviyoSwitch, PortalSwitch, StripeMark  
   - ClientMark, SlackSpaceMark, BillGuard, HubSpotHop, TabClient  
2. **Each app is its own paid product** — no suite / no bundle license.  
3. **Pricing (current preference):** Free core + **Pro $3.99/mo** or **$29/yr** per app (Lemon Squeezy). Optional lifetime ≥ annual.  
4. **No advertising inside the apps** — Pro unlock only.  
5. **Ship order per app:** Chrome → Edge → Firefox.  
6. **Submit order:** do **not** dump all 10 into review on day one. Prioritize:
   1. ShopSwitch  
   2. PortalSwitch  
   3. ClientMark  
   then HelpdeskHop → KlaviyoSwitch → StripeMark → SlackSpaceMark → HubSpotHop → BillGuard → TabClient last.  
7. **v1:** `chrome.storage.local` only — no backend, no analytics, no accounts, no `<all_urls>`.

---

## What’s already done

| Item | Status |
|------|--------|
| All 10 apps built under `apps/<id>/` | Done on PR #7 |
| Shared architecture (switcher / marker / guard) | [`docs/extension-architecture.md`](extension-architecture.md) |
| Operating model | [`docs/extension-operating-model.md`](extension-operating-model.md) |
| Store shipping + permission matrix | [`docs/extension-store-shipping.md`](extension-store-shipping.md) |
| Approval how-to (where to click) | [`docs/extension-store-approval-guide.md`](extension-store-approval-guide.md) |
| Catalog | [`apps/store-kit/catalog.json`](../apps/store-kit/catalog.json) |
| UAT harness + CRUD tests | `scripts/uat-top10.mjs`, `apps/*/lib/uat.crud.test.ts` |
| UAT report | [`docs/uat-top10-report.md`](uat-top10-report.md) |
| ClientMark broad host `https://*/*` removed | Done — keep it that way |

### Related older PRs (partial / deferred apps — do not treat as active portfolio)
- PR #1 ReplyKit — deferred  
- PR #2 StorePulse, ClientMark, BidMatch — ClientMark superseded/merged into #7; others secondary/deferred  
- PR #3 PayBump / PromptLedger / EvidenceKit — deferred  
- PR #4 ShopSwitch / CiteBrowse / FormPack — ShopSwitch in #7; others deferred  
- PR #5 shipping docs / older top-7 notes — superseded by #7 docs where they conflict  
- PR #6 PortalSwitch / BillGuard / RefundRadar / VariantDiff — PortalSwitch+BillGuard in #7; ops tools secondary  

**Prefer branch/PR #7** for continuing work on the ten.

---

## App map

| App | Path | Shape | Hosts (narrow) |
|-----|------|-------|----------------|
| ShopSwitch | `apps/shopswitch` | Switcher | Shopify admin |
| HelpdeskHop | `apps/helpdeskhop` | Switcher | Gorgias, Zendesk, Intercom |
| KlaviyoSwitch | `apps/klaviyoswitch` | Switcher | Klaviyo |
| PortalSwitch | `apps/portalswitch` | Switcher | QuickBooks, Xero |
| StripeMark | `apps/stripemark` | Marker | dashboard.stripe.com |
| ClientMark | `apps/clientmark` | Marker | Google/Meta Ads |
| SlackSpaceMark | `apps/slackspacemark` | Marker | app.slack.com |
| BillGuard | `apps/billguard` | Guard | Ads + billing URL confirm |
| HubSpotHop | `apps/hubspothop` | Switcher | HubSpot |
| TabClient | `apps/tabclient` | Marker | Explicit SaaS allowlist only |

**Secondary (built elsewhere, not in core 10):** StorePulse, RefundRadar, VariantDiff  
**Cut:** PayBump, ReplyKit, BidMatch, FormPack, PromptLedger, EvidenceKit, CiteBrowse  

---

## Architecture (do not reinvent)

Stack: **WXT MV3 + React 19 + TypeScript + Tailwind v4 + `browser.storage.local`**

- **Switcher:** popup list/save/open + content-script color bar; `parseTargetUrl` / shopify/portal parsers  
- **Marker:** label + URL substring + color bar + optional tab rename  
- **Guard (BillGuard):** marker + billing-URL confirm modal  

Rules for any change:
- Never add `<all_urls>` or `https://*/*`  
- Never add ads, remote code, or analytics in v1  
- Keep each app independently zip-able  
- Add/keep unit tests for parsers and CRUD mocks  

Details: [`docs/extension-architecture.md`](extension-architecture.md)

---

## Commands

```bash
git fetch origin cursor/top-ten-agency-extensions-cfb0
git checkout cursor/top-ten-agency-extensions-cfb0

# Single app
cd apps/shopswitch
npm install && npm test && npm run compile && npm run build

# All ten
for id in shopswitch helpdeskhop klaviyoswitch portalswitch stripemark \
          clientmark slackspacemark billguard hubspothop tabclient; do
  (cd apps/$id && npm install && npm test && npm run compile && npm run build) || exit 1
done

# Contract UAT
node scripts/uat-top10.mjs
```

Chrome 148+ in some cloud VMs **blocks `--load-extension`**. Popup UAT can serve `.output/chrome-mv3` with mocked `browser.*` (see prior UAT notes). Real content-script bars need desktop **Load unpacked**.

---

## Store launch (human + agent assist)

### Accounts / URLs
| Store | Console |
|-------|---------|
| Chrome | https://chrome.google.com/webstore/devconsole (~$5 once) |
| Edge | https://partner.microsoft.com/dashboard → Edge |
| Firefox | https://addons.mozilla.org/developers/ |

### Free privacy hosting (required)
Public HTTPS privacy pages — **GitHub Pages is enough** (custom domain optional):  
`https://<user>.github.io/<repo>/privacy/<app>`

### Per app before submit
1. Build zip  
2. Privacy URL live  
3. Screenshots + single-purpose listing  
4. Permission justifications  
5. Submit Chrome → after learnings, Edge → Firefox  

Full steps: [`docs/extension-store-approval-guide.md`](extension-store-approval-guide.md)

---

## Monetization (locked direction)

- **No ads in extensions**  
- Lemon Squeezy, **separate product per app**  
- Free = core job (cap saved clients, e.g. 5)  
- Pro = **$3.99/mo** or **$29/yr** (preferred pairing)  
- Do not gate safety core (basic switch / BillGuard confirm)  

---

## Highest-impact apps (if time-boxed)

1. ShopSwitch  
2. HelpdeskHop  
3. KlaviyoSwitch  
4. PortalSwitch  
5. StripeMark  

---

## Suggested next tasks for the next agent

Pick up in order unless the user redirects:

1. **Sync pricing docs** — ensure operating model / catalog say `$3.99/mo` + `$29/yr` (not older $29 lifetime-only language).  
2. **Store asset pack** — seed `apps/<app>/store/*` for ShopSwitch, PortalSwitch, ClientMark (listing, PRIVACY, PERMISSIONS, REVIEW_NOTES, screenshot checklist).  
3. **GitHub Pages privacy site** — static pages for all 10 privacy policies + support email placeholders.  
4. **Firefox gecko ids** — wire `browser_specific_settings` via store-kit snippet for ship script.  
5. **Lemon Squeezy stub** — optional Pro unlock flag in settings UI (local license key validation) without backend.  
6. **Do not** expand into `<all_urls>` tools or rebuild deferred apps unless user asks.  
7. **Do not** submit all 10 to CWS simultaneously on first attempt.

---

## Confidence / expectations (for user-facing answers)

- These are **niche-positioned**, not invent-the-category unique.  
- Downloads need distribution (agency niches), not store SEO alone.  
- If ~5 apps approved + light marketing: rough combined net often **$250–900/mo** in a decent case; near $0 without Pro + installs.  
- Outliers exist; don’t promise salary-level passive income.

---

## Quick “you are here” checklist

```
[x] Ten apps coded on cursor/top-ten-agency-extensions-cfb0
[x] Architecture + approval docs
[x] UAT scripts green in prior session
[ ] Privacy host pages live
[ ] First Chrome submissions (ShopSwitch → PortalSwitch → ClientMark)
[ ] Pro checkout (Lemon Squeezy) per app
[ ] Edge + Firefox after Chrome learnings
```

**When in doubt:** prefer review safety and leave-alone ops over new features.
