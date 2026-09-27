# Extension store shipping guide

**Ship order:** Chrome Web Store → Microsoft Edge Add-ons → Firefox Add-ons (AMO)

These micro apps are **end-user browser extensions**. Distribution is through browser stores, not Load unpacked and not WordPress/Wix.

Shared tooling lives in [`apps/store-kit/`](../apps/store-kit/).

---

## Catalog

**Operating model (top 7 review-safe):** [`docs/extension-operating-model.md`](extension-operating-model.md)

### Active (submit to stores)

| Priority | App | Path | One-line pitch | Hosts |
|----------|-----|------|----------------|-------|
| P0 | ShopSwitch | `apps/shopswitch` | Multi-store Shopify admin switcher | Narrow |
| P0 | StorePulse | `apps/storepulse` | Shopify store health checks for agencies | Narrow |
| P0 | ClientMark | `apps/clientmark` | Label Meta/Google Ads client accounts | Narrow |
| P1 | PortalSwitch | `apps/portalswitch` | Jump between QuickBooks/Xero clients | Narrow |
| P1 | RefundRadar | `apps/refundradar` | Flag refund/return spikes on Shopify | Narrow |
| P1 | VariantDiff | `apps/variantdiff` | Diff product/variant changes before publish | Narrow |
| P1 | BillGuard | `apps/billguard` | Confirm client before ads billing changes | Narrow |

Ship P0 first: **ShopSwitch → StorePulse → ClientMark**, then PortalSwitch → RefundRadar → VariantDiff → BillGuard.

### Deferred (do not submit)

PayBump · ReplyKit · BidMatch · FormPack · PromptLedger · EvidenceKit · CiteBrowse — broad hosts and/or weaker review/wedge fit.

---

## 0. One-time account setup

### Chrome Web Store
1. Open [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay the **one-time registration fee** (~$5 USD)
3. Accept developer terms
4. Create a Google account dedicated to publishing if you want billing/separation

### Microsoft Edge Add-ons
1. Open [Partner Center](https://partner.microsoft.com/dashboard) → Edge extensions
2. Register as a developer (Microsoft account; usually **no fee**)
3. Link/verify publisher identity when prompted

### Firefox Add-ons (AMO)
1. Open [Add-ons Developer Hub](https://addons.mozilla.org/developers/)
2. Sign in with Mozilla account (**free**)
3. Complete developer profile / distribution agreement

### Also create once
- A **public privacy policy URL** (GitHub Pages, Notion public page, or your domain)
- A **support email** (e.g. `support@yourdomain.com`)
- Optional: simple landing page with “Add to Chrome / Edge / Firefox” buttons

---

## 1. App-side checklist (before any store upload)

Do this **per extension**. Templates: `apps/store-kit/templates/`.

### Required for review (all stores)
| Item | Why |
|------|-----|
| Stable `name`, `description`, `version` in `wxt.config.ts` | Listing + update diffs |
| Icons 16 / 32 / 48 / 128 (and 96 if present) | Store + toolbar |
| **Privacy policy** (public URL) | Mandatory when you handle any site data / host permissions |
| Permission justifications | Reviewers ask “why this permission?” |
| Single-purpose description | Policy: one clear purpose per extension |
| No remote undocumented code | MV3 + no surprise eval/CDN script injection |
| Screenshots (see below) | Listing quality + fewer rejections |

### Strongly recommended
| Item | Why |
|------|-----|
| `store/listing.md` | Copy/paste into each console |
| `store/PRIVACY.md` | Source of the public privacy page |
| `store/PERMISSIONS.md` | Paste into “permission justification” fields |
| Narrow `host_permissions` where possible | Broad `<all_urls>` gets extra scrutiny |
| In-popup “Privacy” / “Data stays on device” line | Builds trust; matches policy |
| Support URL + homepage URL | Store listing fields |

### Screenshots (prepare before upload)
| Asset | Chrome | Edge | Firefox |
|-------|--------|------|---------|
| Promo tile / marquee | 440×280 (small), 920×680 (large) optional | Similar promo images |  |
| Screenshots | **1280×800** or **640×400** | 1280×800 preferred | 1280×800 |
| Count | 1–5 sharp shots of the **popup + one in-context use** | Same | At least 1 |

Capture tips:
- Use a clean browser profile
- Show the real job (e.g. ReplyKit inserting a proposal, ShopSwitch store list)
- No fake 5-star overlays or misleading chrome

### Data / privacy posture (what reviewers want to hear)
Most of these apps are **local-first**:
- Data in `chrome.storage.local` (or browser.storage)
- **No account required**
- **No analytics SDK** unless you add one later (if you do, update privacy policy)
- Content scripts only to provide the stated feature

If you later add Lemon Squeezy / sync:
- Say so in privacy policy
- Name the processor and data categories
- Keep a “local-only free tier” story accurate

---

## 2. Build artifacts (ship order tooling)

From repo root (after the extension app exists on your branch):

```bash
# One app → Chrome, Edge, and Firefox zips
./scripts/ship-extension.sh replykit

# All known micro apps
./scripts/ship-all-extensions.sh
```

Outputs (per app):

```
apps/<name>/.output/
  chrome-mv3/           # unpacked (dev load)
  firefox-mv3/          # unpacked Firefox build
  store-ship/
    <name>-chrome.zip
    <name>-edge.zip     # Chromium package (usually same as Chrome)
    <name>-firefox.zip
```

Manual equivalents:

```bash
cd apps/<name>
npm install
npm run build                 # Chrome/Chromium MV3
npm run zip                   # Chrome zip (WXT)
npm run build:firefox
npm run zip:firefox
```

**Edge:** upload the **Chrome/Chromium MV3 zip** (same package in almost all cases).  
**Firefox:** upload the **Firefox zip** from WXT (`-b firefox`).

Seed store metadata into an app:

```bash
./scripts/seed-extension-store.sh replykit
```

---

## 3. Chrome Web Store — publish process

1. Build: `./scripts/ship-extension.sh <name>`
2. Dashboard → **New item** → upload `store-ship/<name>-chrome.zip`
3. Fill listing from `apps/<name>/store/listing.md` (or store-kit template)
4. **Privacy practices**
   - Declare whether you collect data (for local-only: generally “no” / does not collect — be accurate)
   - Link privacy policy URL
   - Justify each sensitive permission
5. **Distribution:** Public (or Unlisted for soft launch)
6. Submit for review
7. Wait for email; fix any rejection notes; resubmit

### Chrome rejection hotspots
- `<all_urls>` / broad host access without a crisp single purpose
- Description doesn’t match actual behavior
- Missing / vague privacy policy
- Asking for `tabs` + `scripting` + hosts when a narrower match would work
- Trademarked names in title (e.g. don’t put “Shopify” in a way that implies affiliation — say “for Shopify admin” in description carefully)

---

## 4. Edge Add-ons — publish process

1. Prefer **submitting after Chrome is approved** (smoother; you can still submit in parallel)
2. Partner Center → Edge extensions → **New extension**
3. Upload `<name>-edge.zip` (Chromium build)
4. Reuse Chrome listing copy, screenshots, privacy URL
5. Complete age rating / privacy questionnaire
6. Submit for certification

Edge often accepts Chromium MV3 packages with minimal changes. If they ask for differences, point at the same local-first privacy policy.

---

## 5. Firefox AMO — publish process

1. Ensure Firefox build runs: `cd apps/<name> && npm run build:firefox`
2. Upload `<name>-firefox.zip` at [AMO developer hub](https://addons.mozilla.org/developers/addon/submit/)
3. Choose distribution: **On this site** (listed) or self-distribution (usually listed)
4. Fill listing + privacy policy URL
5. Submit for review (automated + human)

### Firefox-specific app needs
- `browser_specific_settings.gecko.id` in manifest (WXT can set via `manifest` → `browser_specific_settings`)
- No Chrome-only APIs without guards
- Use `browser.*` (WXT/polyfill handles this)
- Content script matches must be valid for Firefox
- If you use `contextMenus`, same as Chrome

Seed gecko id when you run `seed-extension-store.sh` (writes into `wxt.config` notes / store file). You must add a unique id like `replykit@yourdomain.com` in `wxt.config.ts` before Firefox submission.

---

## 6. Permission matrix (review talking points)

Use language like: *“Used only to X. Data stays in local extension storage. Not sold. Not used for ads.”*

| Permission | Apps that need it | Review justification (pattern) |
|------------|-------------------|--------------------------------|
| `storage` | All | Save user snippets/settings locally on device |
| `activeTab` | Most | Run feature on the tab the user invoked via popup/action |
| `scripting` | Most | Insert text / scan page / highlight when user clicks |
| `tabs` | ClientMark, ShopSwitch, EvidenceKit | Read active tab URL/title or capture visible tab for user-initiated evidence |
| `contextMenus` | PromptLedger, CiteBrowse | Explicit right-click “save selection/citation” |
| Host access (narrow) | StorePulse, ClientMark, ShopSwitch, PayBump | Only on product dashboards named in the description |
| Host access (`<all_urls>`) | BidMatch, FormPack, CiteBrowse, ReplyKit/PayBump expand | Feature must work on arbitrary sites the user visits; activated by user settings/actions |

**Tighten before submit when you can** (helps review):
- Prefer match patterns over `<all_urls>`
- Prefer `activeTab` + user gesture over always-on content scripts where UX allows

---

## 7. Per-app store folder layout

After seeding:

```
apps/<name>/store/
  listing.md          # name, short/long description, category
  PRIVACY.md          # publish this to a public URL
  PERMISSIONS.md      # justification table for consoles
  REVIEW_NOTES.md     # single-purpose statement + test steps for reviewer
  SCREENSHOTS.md      # shot list / filenames
```

---

## 8. Reviewer test plan (put in REVIEW_NOTES.md)

Give reviewers a 2-minute path:

1. Install extension
2. Open popup → expect branded UI
3. Perform one core action (bullet steps)
4. Confirm data location (“Application → Extension storage” / local only)
5. Confirm no account wall

Example (ReplyKit):

1. Open Gmail or any text box on example.com  
2. Open ReplyKit → click a starter snippet  
3. Confirm text inserted  
4. Type `;intro` + Space → expand  

---

## 9. Post-approval ops

- Bump `version` in `wxt.config.ts` / `package.json` for every store upload
- Ship the same version notes to all three stores
- Keep privacy policy URL stable (don’t 404)
- If you add analytics, accounts, or sync — **update privacy + resubmit**
- Chrome: roll out gradually (optional % rollout) on risky updates

---

## 10. What this repo does *not* automate

- Paying the Chrome developer fee
- Clicking submit in each console
- Guaranteeing approval timelines
- Hosting your public privacy policy URL (you must publish `PRIVACY.md` somewhere public)

---

## Quick start (operator)

```bash
# 1) Seed store metadata for an app
./scripts/seed-extension-store.sh paybump

# 2) Edit apps/paybump/store/*.md — especially PRIVACY + listing

# 3) Publish PRIVACY.md to a public URL; paste URL into listing.md

# 4) Build zips
./scripts/ship-extension.sh paybump

# 5) Upload store-ship/paybump-chrome.zip to Chrome → submit
# 6) After Chrome OK (or in parallel): upload paybump-edge.zip to Edge
# 7) Add gecko id → build Firefox → upload paybump-firefox.zip to AMO
```
