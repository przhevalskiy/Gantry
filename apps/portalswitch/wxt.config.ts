import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'PortalSwitch',
    description:
      'Jump between QuickBooks and Xero client companies — save, label, and open the right portal.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'activeTab'],
    host_permissions: [
      'https://app.qbo.intuit.com/*',
      'https://qbo.intuit.com/*',
      'https://go.xero.com/*',
      'https://*.xero.com/*',
    ],
    action: { default_title: 'PortalSwitch' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
