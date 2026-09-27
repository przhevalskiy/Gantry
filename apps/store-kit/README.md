# Store kit — Chrome → Edge → Firefox

Templates and helpers for publishing Gantry micro extensions.

**Active portfolio (top 5):** PayBump · ShopSwitch · ReplyKit · ClientMark · StorePulse  
**Operating model:** [`docs/extension-operating-model.md`](../../docs/extension-operating-model.md)  
**Store process:** [`docs/extension-store-shipping.md`](../../docs/extension-store-shipping.md)

## Commands

```bash
# Copy store/ templates into an app
./scripts/seed-extension-store.sh replykit

# Build Chrome + Edge + Firefox zips for one app
./scripts/ship-extension.sh replykit

# Build all apps that have wxt.config.ts
./scripts/ship-all-extensions.sh
```

## Templates

| File | Purpose |
|------|---------|
| `templates/listing.md` | Store listing copy |
| `templates/PRIVACY.md` | Privacy policy (publish publicly) |
| `templates/PERMISSIONS.md` | Permission justifications |
| `templates/REVIEW_NOTES.md` | Reviewer walkthrough |
| `templates/SCREENSHOTS.md` | Screenshot checklist |
| `catalog.json` | App metadata for shipping scripts |
