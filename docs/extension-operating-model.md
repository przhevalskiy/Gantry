# Operating model — top 7 review-safe micro extensions

**Active portfolio (ship these):** ShopSwitch · StorePulse · ClientMark · PortalSwitch · RefundRadar · VariantDiff · BillGuard  

**Cut / deferred (do not submit):** PayBump · ReplyKit · BidMatch · FormPack · PromptLedger · EvidenceKit · CiteBrowse  

Browser ship order per app: **Chrome → Edge → Firefox**  
Tooling: [`docs/extension-store-shipping.md`](extension-store-shipping.md) · [`apps/store-kit/`](../apps/store-kit/)

---

## Why these seven

Selected for **easiest store review** first, then **strongest wedge** on our stack (WXT + React + local `chrome.storage`, no backend).

| Review filter (must pass) | Rule |
|---------------------------|------|
| Host access | **Narrow** platform hosts only — never `<all_urls>` |
| Purpose | Single obvious job in listing + UI |
| Data | Local-only v1; no accounts, analytics, or remote code |
| Permissions | Prefer `storage` + `activeTab` / host-limited `scripting` |
| Surface | No scraping marketplaces at scale, no affiliate injection, no page takeover |

| Wedge filter (must pass) | Rule |
|--------------------------|------|
| Buyer | Named B2B role with budget (agency, bookkeeper, ads buyer) |
| Job | Daily/weekly pain; bookmarks/spreadsheets are the competitor |
| Maint | Rules + lists + overlays — not model APIs or site reverse-engineering races |
| Stack fit | Popup + content script on known admin URLs |

---

## 1. Portfolio

| Priority | App | Path | Customer | Core job | Hosts | Maint |
|----------|-----|------|----------|----------|-------|-------|
| P0 | **ShopSwitch** | `apps/shopswitch` | Shopify agencies | Jump between client admins | Shopify admin | Very low |
| P0 | **StorePulse** | `apps/storepulse` | Shopify agencies | Health scan + client report | Shopify admin | Low |
| P0 | **ClientMark** | `apps/clientmark` | Ads buyers | Label Meta/Google Ads accounts | Ads consoles | Low |
| P1 | **PortalSwitch** | `apps/portalswitch` | Bookkeepers | Jump between QB/Xero clients | QB + Xero | Very low |
| P1 | **RefundRadar** | `apps/refundradar` | Shopify / DTC ops | Flag refund/return spikes | Shopify admin | Low |
| P1 | **VariantDiff** | `apps/variantdiff` | Shopify merchants | Diff product/variant before publish | Shopify admin | Low |
| P1 | **BillGuard** | `apps/billguard` | Ads buyers | Confirm client before billing changes | Ads billing URLs | Low |

### Clusters (reuse patterns)
```
Shopify agency:  ShopSwitch · StorePulse · RefundRadar · VariantDiff
Ads agency:      ClientMark · BillGuard
Accounting:      PortalSwitch
```

### Strongest wedges (rank)
1. ShopSwitch — daily multi-store hopping  
2. PortalSwitch — same pattern, underserved vertical  
3. StorePulse — client-billable health report  
4. BillGuard — high-stakes “wrong account” mistakes  
5. ClientMark — constant account mix-ups  
6. RefundRadar — ops signal on pages they already live in  
7. VariantDiff — pre-publish mistake prevention  

### Explicitly cut
| App | Why cut |
|-----|---------|
| PayBump, ReplyKit | Broad hosts + weak uniqueness → harder review, softer wedge |
| BidMatch, FormPack | Broad `<all_urls>`, higher review + support |
| PromptLedger, EvidenceKit, CiteBrowse | More UX/support surface; revisit later |

---

## 2. System shape (low overhead)

```
shared:  store-kit · ship scripts · privacy host · support inbox
   │
   ├── ShopSwitch
   ├── StorePulse
   ├── ClientMark
   ├── PortalSwitch
   ├── RefundRadar
   ├── VariantDiff
   └── BillGuard
```

**One system, seven store products.**

| Layer | Shared | Per app |
|-------|--------|---------|
| Code | WXT + React + Tailwind patterns | Feature logic only |
| Privacy | One domain, `/privacy/<app>` | App-specific data types |
| Support | One email / form | Tag by app name |
| Release | `ship-extension.sh` | Version bump + zip |
| Paid Pro | Same Lemon Squeezy account | **Separate product + license per app** (no suite) |

**v1 rule:** no servers, no accounts, no analytics. Sync later = privacy update + resubmit.

---

## 3. Roles (solo or tiny team)

| Role | Owner | Cadence |
|------|-------|---------|
| Publisher | You | Store consoles, version uploads |
| Support | You (async) | Reply within 48h; FAQ in listing |
| Eng | You / agent | Bugfix + starter-content updates |
| Marketing | You | 1 launch post per app; no paid ads until retention known |

Target overhead: **&lt; 3 hours/week** once all seven are approved.

---

## 4. Ship sequence

### Phase A — Foundations (once)
1. Chrome Web Store developer account (~$5)  
2. Edge Partner Center  
3. Firefox AMO account  
4. Public privacy host (GitHub Pages is fine)  
5. Support email  

### Phase B — P0 (code already exists)
**ShopSwitch → StorePulse → ClientMark**

```bash
./scripts/seed-extension-store.sh <app>
# Edit store/listing.md + PRIVACY.md (real email/URLs)
# Publish PRIVACY.md to https://your.domain/privacy/<app>
./scripts/ship-extension.sh <app>
```

Per app: **Chrome → Edge → Firefox**. Finalize listing/privacy on one before submitting the next to Chrome.

### Phase C — P1 (build then ship)
**PortalSwitch → RefundRadar → VariantDiff → BillGuard**  
Same seed → privacy → ship loop. Clone ShopSwitch for PortalSwitch; clone StorePulse patterns for RefundRadar/VariantDiff; clone ClientMark for BillGuard.

### Phase D — Stabilize
- Freeze features 2–4 weeks  
- Bugfixes + listing tweaks only  
- Collect 5–10 real user notes before Pro  

---

## 5. Weekly operating cadence

| Day | Action |
|-----|--------|
| Mon | Store emails + support inbox (15 min) |
| Wed | One fix or content tweak max (45–90 min) |
| Fri | Status: in review / live / blocked (10 min) |

**Hard cap:** no new extension ideas until P0 are live on Chrome.

---

## 6. Release checklist (every upload)

- [ ] `version` bumped in `wxt.config.ts` + `package.json`  
- [ ] `npm test && npm run compile && npm run build` green  
- [ ] `./scripts/ship-extension.sh <app>` produced chrome/edge/firefox zips  
- [ ] Host permissions still narrow and justified in listing  
- [ ] Privacy URL still live  
- [ ] Listing “What’s new” filled  
- [ ] Same version number on all stores when possible  

---

## 7. Support playbook (keep it tiny)

| Issue type | Response |
|------------|----------|
| “How do I install?” | Store link only |
| “Data / privacy?” | Link privacy page; local storage |
| “Doesn’t work on X page?” | Confirm focus; known host list only |
| Feature request | Log; don’t build unless it reduces support |

---

## 8. Success metrics (simple)

| Metric | Target (first 90 days) |
|--------|-------------------------|
| Chrome approvals | 3/3 P0 approved |
| Installs (P0) | Traction signal — e.g. 50+ combined |
| Support load | &lt; 5 tickets/week combined |
| Permission anger / 1-star | Near zero |

Kill or rewrite any app with support load disproportionate to installs.

---

## 9. Pricing — each app is its own paid product

**Rule:** seven separate SKUs. No suite, no bundle, no cross-app license.

| Item | Policy |
|------|--------|
| Billing | Lemon Squeezy (merchant of record) |
| Unit | **One paid product per app** |
| Default price | **$29 lifetime** per app (or $9/mo if you later prefer recurring — still per app) |
| Free tier | Core job stays free/local so installs keep flowing |
| Pro unlock | Soft extras only (higher client/store caps, export packs) — never gate the safety core |
| Ops | License key → unlock in that app only; no seats, no usage meters |

### Rollout
1. Ship each app free until it has real users  
2. Turn on **that app’s** Pro product when ready (start with ShopSwitch, PortalSwitch, StorePulse)  
3. Repeat per app — separate checkout links, separate license keys  

Keep free-tier claims accurate in each listing/privacy page.

---

## 10. Expansion verticals (review-easy candidates)

Not in the active seven — backlog only after P0 is live. Same filters: **narrow hosts**, single purpose, local-only, no `<all_urls>`.

### Download magnets (wrong-account / switcher pattern)
| Vertical | App sketch | Narrow hosts (examples) |
|----------|------------|-------------------------|
| Support helpdesk | **HelpdeskHop** | Gorgias, Zendesk, Intercom, Freshdesk |
| Email ESP | **KlaviyoSwitch** | Klaviyo admin |
| Payments | **StripeMark** | Dashboard Stripe |
| CRM | **HubSpotHop** / **SalesforceMark** | HubSpot, Lightning |
| Project ops | **AsanaMark** / **ClickUpMark** | Asana, ClickUp, Monday |
| Universal agency | **TabClient** | Allowlisted SaaS hosts only |

### Commerce / marketplace ops
| Vertical | App sketch | Narrow hosts |
|----------|------------|--------------|
| Shopify merch | **PricePin**, **PolicyWatch** | Shopify admin |
| Amazon seller | **SellerStamp** (label Seller Central marketplace/account) | sellercentral.amazon.* |
| Etsy seller | **EtsyShopHop** | Etsy seller/shop manager |
| eBay | **eBaySellerMark** | eBay seller hub |
| Woo / WordPress admin | **WooStoreHop** | `*/wp-admin*` on known merchant patterns — prefer explicit shop admin hosts if possible |

### Ads / growth (beyond current ClientMark / BillGuard)
| Vertical | App sketch | Narrow hosts |
|----------|------------|--------------|
| LinkedIn Ads | **LiAdsMark** | linkedin.com/campaignmanager |
| TikTok Ads | **TikAdsMark** | ads.tiktok.com |
| Pinterest Ads | **PinAdsMark** | ads.pinterest.com |
| Analytics | **GA4PropertyMark** | analytics.google.com |
| Affiliate | **ImpactMark** / **PartnerStackMark** | Impact, PartnerStack portals |

### Professional services
| Vertical | App sketch | Narrow hosts |
|----------|------------|--------------|
| Legal practice | **ClioMatterMark** | Clio |
| Accounting (beyond PortalSwitch) | **FreshBooksHop**, **WaveMark** | FreshBooks, Wave |
| Recruiting | **LeverMark** / **GreenhouseMark** | Lever, Greenhouse |
| Real estate CRM | **FollowUpBossMark** | Follow Up Boss |
| Agencies (design) | **FigmaFileMark** | Figma (file/org URL match) |

### Review-safe rules for any new vertical
1. Name **exact** admin hosts in the manifest + listing  
2. One job: switch, label, confirm, or snapshot-diff — not a suite  
3. No remote code, no scraping marketplaces at scale, no affiliate injection  
4. Data stays in `chrome.storage.local` for v1  
5. Separate paid SKU per app ($29 lifetime default)

**Do not expand** into broad autofill, AI wrappers, or `<all_urls>` tools until the narrow-host machine is proven.

---

## 11. Command cheat sheet

```bash
./scripts/ship-all-extensions.sh    # activeWave only
./scripts/seed-extension-store.sh shopswitch
./scripts/ship-extension.sh shopswitch

# Chrome: https://chrome.google.com/webstore/devconsole
# Edge:   https://partner.microsoft.com/dashboard
# Firefox:https://addons.mozilla.org/developers/
```

---

## One-page summary

**Narrow-host, single-purpose, local-first tools → Chrome then Edge then Firefox → each app its own paid Pro SKU → async support → no suite.**
