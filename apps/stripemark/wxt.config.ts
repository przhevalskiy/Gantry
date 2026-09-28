import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'StripeMark',
    description: 'Color-label which Stripe account you are working in.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'activeTab', 'scripting'],
    host_permissions: [
      'https://dashboard.stripe.com/*'
    ],
    action: { default_title: 'StripeMark' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
