import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'FormPack',
    description:
      'Niche form autofill packs — shipping, grant applications, and admin profiles filled in one click.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'FormPack' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
