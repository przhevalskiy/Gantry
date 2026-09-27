# ReplyKit

Niche snippet manager Chrome extension for freelancers — the easiest passive-income lift from the Gantry product brainstorm.

Save proposal macros, insert them into any text field, or expand shortcuts like `;intro` while typing.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Extension framework | **WXT** (Manifest V3) | Best DX, HMR, multi-browser |
| UI | **React 19 + TypeScript** | Fast popup/options |
| Styling | **Tailwind CSS v4** | Small, consistent UI |
| Persistence | **`chrome.storage.local`** | Zero backend for v1 |
| Monetization hook | Settings `pro` object | Ready for Lemon Squeezy + sync |

## Features (v0.1)

- CRUD snippets with niche tags (Upwork / Email / Support / General)
- One-click insert into the focused field on the active tab
- Shortcut expansion (`;intro` + Space/Enter/Tab)
- Upwork starter pack seeded on first run
- Options page: import/export JSON, reset starters, Pro roadmap stub

## Develop

```bash
cd apps/replykit
npm install
npm run dev
```

Load the unpacked extension from `.output/chrome-mv3` (WXT opens a browser in dev mode).

```bash
npm run build   # production build → .output/chrome-mv3
npm run zip     # Chrome Web Store zip
npm test
npm run compile
```

## Monetization path

1. Ship free local-only on Chrome Web Store  
2. Add Lemon Squeezy license → unlock sync (`settings.pro`)  
3. Price ~$5–12/mo for device sync + team libraries  

## Niche angle

Default starters target **Upwork / freelance proposals**. Same codebase works for Shopify support macros or agency snippets — swap the starter pack.
