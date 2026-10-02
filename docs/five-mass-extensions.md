# Five mass-use extensions

Branch: `cursor/five-mass-extensions-cfb0`

| App | Path | What it does |
|-----|------|----------------|
| **FeedKill** | `apps/feedkill` | Hide YouTube Shorts / IG Reels / X For You |
| **MediaBoost** | `apps/mediaboost` | Speed + volume (+ Web Audio boost) on HTML5 media |
| **LinkWash** | `apps/linkwash` | Strip tracking params on copy + context menu |
| **TabSleep** | `apps/tabsleep` | Discard idle tabs; save/restore sessions |
| **BannerAway** | `apps/banneraway` | Hide/reject cookie consent banners |

## Build / test / zip (CWS)

```bash
for id in feedkill mediaboost linkwash tabsleep banneraway; do
  (cd apps/$id && npm install && npm test && npm run compile && npm run build && npm run zip)
done
```

Zips land in each app’s `.output/` (and copied to `dist/cws-zips/` by the packaging script).

## Store notes

- FeedKill: narrow hosts → easiest review.
- MediaBoost / LinkWash / BannerAway: broad hosts — justify “read and change data on websites you visit”.
- TabSleep: `tabs` + `alarms` + `storage` only.
- No accounts, no remote code, no analytics in v1.
