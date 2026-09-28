import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'KlaviyoSwitch',
    description: 'Multi-account Klaviyo switcher for email agencies.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'activeTab'],
    host_permissions: [
      'https://www.klaviyo.com/*',
      'https://*.klaviyo.com/*'
    ],
    action: { default_title: 'KlaviyoSwitch' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
