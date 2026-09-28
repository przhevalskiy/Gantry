import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'TabClient',
    description: 'Color and rename browser tabs by client on allowlisted SaaS admin hosts only.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'activeTab', 'scripting'],
    host_permissions: [
      'https://admin.shopify.com/*',
      'https://*.myshopify.com/*',
      'https://ads.google.com/*',
      'https://adsmanager.facebook.com/*',
      'https://business.facebook.com/*',
      'https://app.hubspot.com/*',
      'https://dashboard.stripe.com/*',
      'https://app.slack.com/*',
      'https://mail.google.com/*',
      'https://calendar.google.com/*',
      'https://www.klaviyo.com/*',
      'https://*.klaviyo.com/*',
      'https://app.qbo.intuit.com/*',
      'https://go.xero.com/*',
      'https://*.gorgias.com/*',
      'https://*.zendesk.com/*',
      'https://app.intercom.com/*'
    ],
    action: { default_title: 'TabClient' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
