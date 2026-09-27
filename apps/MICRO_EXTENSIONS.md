# Micro Chrome extensions

Three underserved niche extensions (same stack as ReplyKit):

| App | Path | Audience |
|-----|------|----------|
| **StorePulse** | `apps/storepulse` | Shopify agencies — store health + client report |
| **ClientMark** | `apps/clientmark` | Ads agencies — label Meta/Google client accounts |
| **BidMatch** | `apps/bidmatch` | Freelancers / BD — RFP keyword highlighter |

Each is a standalone WXT project:

```bash
cd apps/<name>
npm install
npm test && npm run build
```
