import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'EvidenceKit',
    description:
      'Compliance evidence packs — screenshot, timestamp, checklist, and exportable proof bundle.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],

    action: { default_title: 'EvidenceKit' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
