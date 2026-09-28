import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'HubSpotHop',
    description: 'Jump between HubSpot client portals for agencies.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'activeTab'],
    host_permissions: [
      'https://app.hubspot.com/*',
      'https://*.hubspot.com/*'
    ],
    action: { default_title: 'HubSpotHop' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
