/**
 * Copy `browser_specific_settings` into each app's wxt.config.ts `manifest`
 * before Firefox AMO submission. Use the gecko id from store/FIREFOX.md
 * (seeded by scripts/seed-extension-store.sh).
 */
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Example',
    version: '0.1.0',
    browser_specific_settings: {
      gecko: {
        id: 'example@gantry.local',
        strict_min_version: '109.0',
      },
    },
  },
});
