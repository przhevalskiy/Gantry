import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'HelpdeskHop',
    description: 'Jump between Gorgias, Zendesk, and Intercom client workspaces.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'activeTab'],
    host_permissions: [
      'https://*.gorgias.com/*',
      'https://*.zendesk.com/*',
      'https://app.intercom.com/*',
      'https://*.intercom.io/*'
    ],
    action: { default_title: 'HelpdeskHop' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
