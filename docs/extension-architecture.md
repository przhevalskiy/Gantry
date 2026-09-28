# Extension architecture (top 10)

Shared design for all agency micro extensions in `apps/*`.

## Stack
- **WXT** (MV3) + **React 19** + **TypeScript** + **Tailwind v4**
- State: `browser.storage.local` only (v1)
- No backend, no remote code, no analytics

## App shapes

### Switcher
`ShopSwitch` · `HelpdeskHop` · `KlaviyoSwitch` · `PortalSwitch` · `HubSpotHop`

```
popup → list/save/open client URLs
content script → 4px color bar when URL matches a saved client
lib/storage.ts → parseTargetUrl() + CRUD
```

### Marker
`StripeMark` · `ClientMark` · `SlackSpaceMark` · `TabClient`

```
popup → save label + URL substring match + color
content script → color bar + optional tab title prefix 【Client】
lib/storage.ts → findMarkForUrl()
```

### Guard
`BillGuard` = marker + billing-URL confirm modal (session ack)

## Review-safe rules
1. `host_permissions` are **named admin hosts only** (TabClient uses an explicit allowlist — never `<all_urls>`)
2. Permissions prefer `storage` + `tabs`/`activeTab`; `scripting` only when labeling the page
3. Unit-test URL parsers / matchers
4. Each app is independently zip-able for store upload

## Layout per app
```
apps/<id>/
  wxt.config.ts          # name, permissions, hosts
  entrypoints/
    background.ts
    content.ts           # optional for pure popup tools
    popup/App.tsx
  lib/types.ts
  lib/storage.ts
  lib/*.test.ts
  public/icon/
```
