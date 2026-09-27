# Operating model — top 5 micro extensions

**Active portfolio (ship these):** PayBump · ShopSwitch · ReplyKit · ClientMark · StorePulse  

**Cut / deferred (do not submit to stores):** BidMatch · FormPack · PromptLedger · EvidenceKit · CiteBrowse  

Browser ship order per app: **Chrome → Edge → Firefox**  
Tooling: [`docs/extension-store-shipping.md`](extension-store-shipping.md) · [`apps/store-kit/`](../apps/store-kit/)

---

## 1. Portfolio

| Priority | App | Path | Customer | Core job | Maintenance load |
|----------|-----|------|----------|----------|------------------|
| P0 | **PayBump** | `apps/paybump` | Indie SaaS | Dunning / invoice macros | Very low (copy) |
| P0 | **ShopSwitch** | `apps/shopswitch` | Shopify agencies | Jump between client admins | Very low (URL list) |
| P0 | **ReplyKit** | `apps/replykit` | Freelancers | Proposal snippet macros | Very low (copy) |
| P1 | **ClientMark** | `apps/clientmark` | Ads buyers | Label ads accounts | Low (match rules) |
| P1 | **StorePulse** | `apps/storepulse` | Shopify agencies | Health scan + client report | Low (scan rules) |

### Why this set
- Tight single purpose → better store review odds  
- Underserved verticals, not generic AI productivity  
- **No backend in v1** → low ops cost  
- Same WXT stack → one playbook for five listings  

### Explicitly cut
| App | Why cut |
|-----|---------|
| BidMatch, FormPack | Broad `<all_urls>`, higher review + support |
| PromptLedger, EvidenceKit, CiteBrowse | More UX/support surface; revisit after P0 is live |

Keep their code in repo PRs if useful, but **do not** seed/submit store listings until the top 5 are live.

---

## 2. System shape (low overhead)

```
shared:  store-kit templates · ship scripts · privacy host · support inbox
   │
   ├── PayBump      (listing)
   ├── ShopSwitch   (listing)
   ├── ReplyKit     (listing)
   ├── ClientMark   (listing)
   └── StorePulse   (listing)
```

**One system, five store products.**

| Layer | Shared | Per app |
|-------|--------|---------|
| Code | WXT + React + Tailwind patterns | Feature logic only |
| Privacy | One domain, `/privacy/<app>` pages | App-specific data types |
| Support | One email / form | Tag by app name |
| Release | `ship-extension.sh` | Version bump + zip |
| Optional Pro later | Same Lemon Squeezy account | License unlock per app or suite |

**v1 rule:** no servers, no accounts, no analytics. If you add sync later, update privacy and resubmit — don’t put it in the first submission.

---

## 3. Roles (solo or tiny team)

| Role | Owner | Cadence |
|------|-------|---------|
| Publisher | You | Store consoles, version uploads |
| Support | You (async) | Reply within 48h; FAQ in listing |
| Eng | You / agent | Bugfix + starter-content updates |
| Marketing | You | 1 launch post per app; no paid ads until retention known |

Target overhead: **&lt; 2 hours/week** once all five are approved (triage + one small fix batch).

---

## 4. Ship sequence

### Phase A — Foundations (once)
1. Chrome Web Store developer account (~$5)  
2. Edge Partner Center  
3. Firefox AMO account  
4. Public privacy host (GitHub Pages is fine)  
5. Support email  

### Phase B — P0 apps (one at a time)
For **PayBump → ShopSwitch → ReplyKit**:

```bash
./scripts/seed-extension-store.sh <app>
# Edit store/listing.md + PRIVACY.md (real email/URLs)
# Publish PRIVACY.md to https://your.domain/privacy/<app>
./scripts/ship-extension.sh <app>
```

Then:
1. Upload **Chrome** zip → submit  
2. After approval (or in parallel if comfortable): **Edge** zip  
3. Add gecko id → **Firefox** zip → AMO  

Do **not** submit the next P0 app to Chrome until the previous one’s listing/privacy copy is finalized (reuse the pattern).

### Phase C — P1 apps
After at least one P0 is live on Chrome: **ClientMark → StorePulse** with the same loop.

### Phase D — Stabilize
- Freeze features for 2–4 weeks  
- Only bugfixes + listing tweaks  
- Collect 5–10 real user notes before any Pro/sync work  

---

## 5. Weekly operating cadence

| Day | Action |
|-----|--------|
| Mon | Check store emails + support inbox (15 min) |
| Wed | One fix or content tweak max across portfolio (45–90 min) |
| Fri | Version/status note: what’s in review / live / blocked (10 min) |

**Hard cap:** no new extension ideas until P0 are live on Chrome.

---

## 6. Release checklist (every upload)

- [ ] `version` bumped in `wxt.config.ts` + `package.json`  
- [ ] `npm test && npm run compile && npm run build` green  
- [ ] `./scripts/ship-extension.sh <app>` produced chrome/edge/firefox zips  
- [ ] Privacy URL still live  
- [ ] Listing “What’s new” filled  
- [ ] Same version number on all stores when possible  

---

## 7. Support playbook (keep it tiny)

| Issue type | Response |
|------------|----------|
| “How do I install?” | Store link only |
| “Data / privacy?” | Link privacy page; local storage |
| “Doesn’t work on X page?” | Confirm focus/permissions; known host list |
| Feature request | Log; don’t build unless it reduces support | 

Canned replies live in a single doc; don’t open a helpdesk product yet.

---

## 8. Success metrics (simple)

| Metric | Target (first 90 days) |
|--------|-------------------------|
| Chrome approvals | 3/3 P0 approved |
| Installs (all P0) | Traction signal, not vanity — e.g. 50+ combined |
| Support load | &lt; 5 tickets/week combined |
| Crash / 1-star permission anger | Near zero; fix or clarify listing fast |

Kill or rewrite an app if it causes disproportionate support vs installs.

---

## 9. Money later (optional, still low ops)

Only after P0 are stable:

1. Shared “Pro” unlock (Lemon Squeezy) for sync or pack export  
2. Or a cheap **suite** license covering all five  
3. Keep free local tier accurate in privacy/listing  

Until then: **distribution + learning**, not billing complexity.

---

## 10. Command cheat sheet

```bash
# Active portfolio only
./scripts/ship-all-extensions.sh    # ships catalog activeWave / firstWave

# Single app
./scripts/seed-extension-store.sh paybump
./scripts/ship-extension.sh paybump

# Store consoles
# Chrome: https://chrome.google.com/webstore/devconsole
# Edge:   https://partner.microsoft.com/dashboard
# Firefox:https://addons.mozilla.org/developers/
```

---

## One-page summary

**Build once (shared kit) → submit five tight listings → Chrome then Edge then Firefox → support async → no backend until revenue justifies it.**  

Cut the broad-host / high-surface apps until that machine is running.
