import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// ReplyKit — niche snippet manager for freelancers
// Stack: WXT (MV3) + React + TypeScript + Tailwind + chrome.storage
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'ReplyKit',
    description:
      'Niche snippet manager for freelancers. Save proposal macros, insert them anywhere, stay fast.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'ReplyKit',
    },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
