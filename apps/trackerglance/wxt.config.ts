import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'TrackerGlance (POC)',
    description:
      'See which known tracker/analytics scripts appear on this page. Read-only — does not block.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: 'TrackerGlance' },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 96: '/icon/96.png', 128: '/icon/128.png' },
  },
});
