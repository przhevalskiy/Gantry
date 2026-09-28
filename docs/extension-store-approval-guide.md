# Store approval guide — top 10 micro extensions

How to get each app **accepted** on Chrome, Edge, and Firefox.  
This is **publisher store review** (listing approval), not end-user star ratings.

**Portfolio:** ShopSwitch · HelpdeskHop · KlaviyoSwitch · PortalSwitch · StripeMark · ClientMark · SlackSpaceMark · BillGuard · HubSpotHop · TabClient  

**Per app ship order:** Chrome → Edge → Firefox  
**Build zips:** `./scripts/ship-extension.sh <app>` (or `cd apps/<app> && npm run zip` after firefox config)

Related: [`extension-operating-model.md`](extension-operating-model.md) · [`extension-store-shipping.md`](extension-store-shipping.md)

---

## 0. One-time accounts (do once)

| Store | Where to go | Cost |
|-------|-------------|------|
| **Chrome Web Store** | [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) | ~$5 one-time |
| **Microsoft Edge Add-ons** | [partner.microsoft.com/dashboard](https://partner.microsoft.com/dashboard) → Edge | Free |
| **Firefox AMO** | [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) | Free |

Also set up:
1. Support email (same for all apps)  
2. Public privacy pages: `https://YOUR.DOMAIN/privacy/<app>` (GitHub Pages is fine)  
3. Lemon Squeezy account later for per-app Pro (not required for first approval)

---

## 1. Before you click Submit (every app)

### A. Build the store package
```bash
cd apps/<app>
npm install
npm test && npm run compile && npm run build
# Prefer shared ship script when present:
# ./scripts/ship-extension.sh <app>
```
Upload the **Chrome zip** first (from `wxt zip` / `store-ship/<app>-chrome.zip`).

### B. Seed listing copy
```bash
./scripts/seed-extension-store.sh <app>   # if store-kit scripts are on this branch
```
Fill in:
- `store/listing.md` — short + long description, single purpose  
- `store/PRIVACY.md` — publish to public URL  
- `store/PERMISSIONS.md` — why each permission  
- `store/REVIEW_NOTES.md` — 2-minute reviewer test plan  
- Screenshots (1280×800 or store-required sizes): popup + one in-context shot on the real admin host  

### C. Reviewer-safe claims (use this language)
- Single purpose: switch / label / confirm on **named** sites only  
- Data stored **locally** in the extension; not sold; no accounts in v1  
- Host permissions limited to the admin hosts listed in the description  

### D. Do **not** submit with
- `<all_urls>`  
- Remote code  
- Undocumented broad `scripting`  
- Privacy URL that 404s  

---

## 2. Chrome Web Store (first for every app)

**Console:** [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)

1. **New item** → upload chrome zip  
2. Store listing: name, summary, description, category (**Productivity**), language  
3. Privacy practices:  
   - Single purpose  
   - Remote code = No  
   - Data use: only local storage as disclosed  
   - Privacy policy URL  
4. Permissions justification: paste from `PERMISSIONS.md`  
5. Distribution: public (or unlisted while testing)  
6. Submit for review  

**Typical wait:** days to a couple of weeks.  
**If rejected:** read the email, fix hosts/copy/permissions, reply/resubmit — don’t widen hosts.

### Per-app Chrome notes
| App | Emphasize in listing |
|-----|----------------------|
| ShopSwitch | Shopify admin multi-store switcher for agencies |
| HelpdeskHop | Gorgias / Zendesk / Intercom workspace switcher |
| KlaviyoSwitch | Klaviyo multi-account switcher |
| PortalSwitch | QuickBooks + Xero client switcher |
| StripeMark | Label Stripe Dashboard account context |
| ClientMark | Label Meta / Google Ads accounts |
| SlackSpaceMark | Label Slack workspace on app.slack.com |
| BillGuard | Confirm client on ads **billing** URLs only |
| HubSpotHop | HubSpot portal switcher |
| TabClient | Tab labels **only** on allowlisted SaaS hosts named in the listing |

---

## 3. Microsoft Edge Add-ons (second)

**Dashboard:** [partner.microsoft.com/dashboard](https://partner.microsoft.com/dashboard) → **Edge** → Extensions

1. Create new extension → upload **Edge** zip (Chromium build; often same as Chrome)  
2. Reuse Chrome listing text + privacy URL + screenshots  
3. Complete certification questionnaire (single purpose, no deceptive behavior)  
4. Submit  

Edge often accepts Chromium extensions that already passed Chrome; still submit separately.

---

## 4. Firefox AMO (third)

**Hub:** [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)

1. Ensure Firefox build has a stable `browser_specific_settings.gecko.id` (see `apps/store-kit/wxt-firefox-snippet.ts` / catalog `geckoId`)  
2. `wxt build -b firefox` / firefox zip from ship script  
3. Submit to AMO → **On-platform** listing  
4. Include source notes if requested (this repo path + build commands)  
5. Privacy policy URL + reviewer test steps  

Firefox review can ask for clearer permission rationale — keep hosts minimal.

---

## 5. Where to click for each store (cheat sheet)

| Step | Chrome | Edge | Firefox |
|------|--------|------|---------|
| Developer home | [CWS DevConsole](https://chrome.google.com/webstore/devconsole) | [Partner Center](https://partner.microsoft.com/dashboard) | [AMO Dev Hub](https://addons.mozilla.org/developers/) |
| Upload package | New item → zip | Edge → Extensions → New | Submit a New Add-on |
| Privacy policy | Listing → Privacy | Listing properties | Product page → Privacy |
| Permission reasons | Privacy practices / declarations | Certification Qs | Notes for reviewers |
| Status / email | DevConsole + Google account email | Partner Center messages | AMO email + Dev Hub |

---

## 6. Recommended submit order (portfolio)

Submit **one Chrome listing at a time** until the template is proven:

1. ShopSwitch  
2. ClientMark  
3. PortalSwitch  
4. BillGuard  
5. HelpdeskHop  
6. KlaviyoSwitch  
7. StripeMark  
8. SlackSpaceMark  
9. HubSpotHop  
10. TabClient  

After each Chrome approval (or clear rejection fix), mirror to Edge, then Firefox.

---

## 7. Architecture checklist (keeps review easy)

Every app in this repo follows:

| Rule | Implementation |
|------|----------------|
| Narrow hosts | `host_permissions` = named admins only |
| Local state | `chrome.storage.local` via `lib/storage.ts` |
| Single purpose | Popup CRUD + optional top color bar / confirm |
| No backend | No remote code, no analytics in v1 |
| Tests | Parser / match unit tests in `lib/*.test.ts` |
| Build | `npm test && npm run compile && npm run build` |

**Switcher apps:** ShopSwitch, HelpdeskHop, KlaviyoSwitch, PortalSwitch, HubSpotHop  
**Marker apps:** StripeMark, ClientMark, SlackSpaceMark, TabClient  
**Guard app:** BillGuard (marker + billing URL confirm modal)

---

## 8. After approval

- Install from the store link (not Load unpacked) for smoke test  
- Reply to support within 48h  
- Version bump for every upload  
- Turn on **per-app** Pro ($3.99/mo or $29/yr) only after installs exist  
- If you add sync/accounts later → update privacy + resubmit  

---

## 9. Quick commands

```bash
# All active apps present on disk
for id in shopswitch helpdeskhop klaviyoswitch portalswitch stripemark \
          clientmark slackspacemark billguard hubspothop tabclient; do
  echo "==== $id ===="
  (cd apps/$id && npm test && npm run compile && npm run build) || exit 1
done
```
