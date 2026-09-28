# Operating model — top 10 review-safe micro extensions

**Active portfolio (ship these):**  
ShopSwitch · HelpdeskHop · KlaviyoSwitch · PortalSwitch · StripeMark · ClientMark · SlackSpaceMark · BillGuard · HubSpotHop · TabClient  

**Secondary / later (built but not core magnets):** StorePulse · RefundRadar · VariantDiff  

**Cut / deferred:** PayBump · ReplyKit · BidMatch · FormPack · PromptLedger · EvidenceKit · CiteBrowse  

Browser ship order per app: **Chrome → Edge → Firefox**  
**Approval how-to:** [`extension-store-approval-guide.md`](extension-store-approval-guide.md)  
Architecture: [`extension-architecture.md`](extension-architecture.md)  
Tooling: [`extension-store-shipping.md`](extension-store-shipping.md) · [`apps/store-kit/`](../apps/store-kit/)

---

## Why these ten

Optimized for **Chrome / Edge / AMO store approval** (not star ratings), then download pull, then low maintenance.

| Store-review filter (must pass) | Rule |
|---------------------------------|------|
| Host access | **Narrow** named admin hosts only — never `<all_urls>` |
| Purpose | Single obvious job in listing + UI |
| Data | Local-only v1; no accounts, analytics, or remote code |
| Permissions | Prefer `storage` + `activeTab` / host-limited `scripting` |
| Surface | No scraping farms, affiliate injection, or page takeover |

| Fit filter (must pass) | Rule |
|------------------------|------|
| Job | Daily “wrong client / wrong workspace” pain |
| Buyer | Agency, bookkeeper, support, email, ads, CRM ops |
| Maint | Lists + labels + switch — not AI or brittle scrapers |
| Paid | Separate Pro SKU per app (no suite): **$3.99/mo** or **$29/yr** |

---

## 1. The ten

| # | App | Path | Customer | Core job | Hosts | Built? |
|---|-----|------|----------|----------|-------|--------|
| 1 | **ShopSwitch** | `apps/shopswitch` | Shopify agencies | Jump client admins | Shopify admin | Yes (PR #4) |
| 2 | **HelpdeskHop** | `apps/helpdeskhop` | Support agencies | Jump helpdesk workspaces | Gorgias, Zendesk, Intercom | No |
| 3 | **KlaviyoSwitch** | `apps/klaviyoswitch` | Email agencies | Jump Klaviyo accounts | Klaviyo | No |
| 4 | **PortalSwitch** | `apps/portalswitch` | Bookkeepers | Jump QB / Xero clients | QuickBooks, Xero | Yes (PR #6) |
| 5 | **StripeMark** | `apps/stripemark` | Indie SaaS / finance ops | Label Stripe account in use | Stripe Dashboard | No |
| 6 | **ClientMark** | `apps/clientmark` | Ads buyers | Label Meta / Google Ads accounts | Ads consoles | Yes (PR #2) |
| 7 | **SlackSpaceMark** | `apps/slackspacemark` | Any agency | Label Slack workspace | app.slack.com | No |
| 8 | **BillGuard** | `apps/billguard` | Ads buyers | Confirm client before billing changes | Ads billing URLs | Yes (PR #6) |
| 9 | **HubSpotHop** | `apps/hubspothop` | CRM / marketing agencies | Jump HubSpot portals | HubSpot | No |
| 10 | **TabClient** | `apps/tabclient` | Multi-tool agencies | Color/rename tabs by client | **Allowlisted** SaaS hosts only | No |

### Pattern clusters
```
Switcher:  ShopSwitch · HelpdeskHop · KlaviyoSwitch · PortalSwitch · HubSpotHop
Marker:    StripeMark · ClientMark · SlackSpaceMark · TabClient
Guard:     BillGuard
```

### Download strength (within the ten)
**Strongest magnets:** ShopSwitch · HelpdeskHop · KlaviyoSwitch · PortalSwitch · StripeMark · SlackSpaceMark · ClientMark · HubSpotHop  
**High value, narrower:** BillGuard · TabClient (TabClient stays review-safe only with a short host allowlist)

### Explicitly not in the ten
| App | Why |
|-----|-----|
| StorePulse, RefundRadar, VariantDiff | Real ops value; slower impulse downloads — ship after magnets |
| PayBump, ReplyKit | Broad hosts + weak uniqueness |
| BidMatch, FormPack, CiteBrowse, etc. | `<all_urls>` / higher review surface |

---

## 2. System shape (low overhead)

```
shared:  store-kit · ship scripts · privacy host · support inbox
   │
   ├── ShopSwitch
   ├── HelpdeskHop
   ├── KlaviyoSwitch
   ├── PortalSwitch
   ├── StripeMark
   ├── ClientMark
   ├── SlackSpaceMark
   ├── BillGuard
   ├── HubSpotHop
   └── TabClient
```

**One system, ten store products — each its own paid SKU.**

| Layer | Shared | Per app |
|-------|--------|---------|
| Code | WXT + React + Tailwind patterns | Feature logic only |
| Privacy | One domain, `/privacy/<app>` | App-specific data types |
| Support | One email / form | Tag by app name |
| Release | `ship-extension.sh` | Version bump + zip |
| Paid Pro | Same Lemon Squeezy account | **Separate product + license per app** |

**v1 rule:** no servers, no accounts, no analytics.

---

## 3. Roles

| Role | Owner | Cadence |
|------|-------|---------|
| Publisher | You | Store consoles, version uploads |
| Support | You (async) | Reply within 48h |
| Eng | You / agent | Bugfix + content tweaks |
| Marketing | You | 1 launch post per app |

Target: **&lt; 3 hours/week** once live.

---

## 4. Ship sequence

### Phase A — Foundations (once)
Chrome ($5) · Edge · AMO · privacy host · support email  

### Phase B — Built magnets first
**ShopSwitch → ClientMark → PortalSwitch → BillGuard**  
(seed → privacy → Chrome → Edge → Firefox)

### Phase C — Build then ship remaining six
**HelpdeskHop → KlaviyoSwitch → StripeMark → SlackSpaceMark → HubSpotHop → TabClient**

### Phase D — Optional ops tools
StorePulse → RefundRadar → VariantDiff (only after magnets are live)

### Phase E — Stabilize
Freeze features 2–4 weeks; bugfixes only; then per-app Pro.

---

## 5. Weekly cadence

| Day | Action |
|-----|--------|
| Mon | Store + support inbox (15 min) |
| Wed | One fix max (45–90 min) |
| Fri | Status note (10 min) |

**Hard cap:** no new ideas until Phase B apps are submitted to Chrome.

---

## 6. Release checklist

- [ ] Version bumped  
- [ ] `npm test && npm run compile && npm run build` green  
- [ ] Host permissions still narrow and named in listing  
- [ ] Privacy URL live  
- [ ] Same version on all stores when possible  

---

## 7. Support playbook

| Issue | Response |
|-------|----------|
| Install? | Store link |
| Privacy? | Privacy page; local storage |
| Wrong page? | Known host list only |
| Feature request | Log; build only if it cuts support |

---

## 8. Success metrics (90 days)

| Metric | Target |
|--------|--------|
| Chrome approvals | Phase B (4/4) approved |
| Installs | Traction on switchers/markers first |
| Support | &lt; 5 tickets/week combined |
| 1-star permission anger | Near zero |

---

## 9. Pricing — each app is its own paid product

**Rule:** ten separate SKUs. No suite. No ads in the apps.

| Item | Policy |
|------|--------|
| Billing | Lemon Squeezy (merchant of record) |
| Monthly | **$3.99/mo** Pro per app |
| Annual | **$29/yr** Pro per app |
| Free | Core switch/label/confirm stays free |
| Pro | Caps / export only — never gate safety core |
| Ops | License key unlocks **that app only**; no seats / usage meters |

---

## 10. Expansion (after the ten)

More named-admin verticals only (Amazon SellerStamp, EtsyShopHop, TikAdsMark, ClioMatterMark, etc.). Same review rules. See prior backlog notes — do not open `<all_urls>`.

---

## 11. Command cheat sheet

```bash
./scripts/ship-all-extensions.sh
./scripts/seed-extension-store.sh shopswitch
./scripts/ship-extension.sh shopswitch
```

---

## One-page summary

**Ten narrow-host “wrong client / wrong workspace” tools → easiest store approval → Chrome then Edge then Firefox → each app its own $29 Pro → leave-alone ops.**
