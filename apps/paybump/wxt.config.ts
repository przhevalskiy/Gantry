import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'PayBump',
    description:
      'Failed-payment and invoice follow-up macros for Stripe Billing and indie SaaS dunning.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: [
      'https://dashboard.stripe.com/*',
      'https://billing.stripe.com/*',
      'https://*/*',
    ],
    action: { default_title: 'PayBump' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
