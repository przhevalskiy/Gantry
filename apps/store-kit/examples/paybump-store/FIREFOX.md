# Firefox notes — PayBump

Before AMO upload, set a unique gecko id in `wxt.config.ts`:

```ts
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // ...existing manifest fields
    browser_specific_settings: {
      gecko: {
        id: 'paybump@gantry.local',
        strict_min_version: '109.0',
      },
    },
  },
});
```

Then:

```bash
./scripts/ship-extension.sh paybump
# upload apps/paybump/.output/store-ship/paybump-firefox.zip to AMO
```
