# StorePulse

Shopify store health checks for **agencies** managing many client stores.

Scan the active admin/storefront tab for broken images, tracking pixels, policy links, alt text, and draft/unpublished cues — then copy a client-ready markdown report.

## Stack

WXT (MV3) · React 19 · TypeScript · Tailwind v4 · `chrome.storage.local`

## Develop

```bash
npm install
npm run dev
npm test && npm run compile && npm run build
```

Load `.output/chrome-mv3` via chrome://extensions → Load unpacked.

## Who it serves

Shopify agencies and freelancers who need a quick pre-launch or monthly store audit without opening five tools.
