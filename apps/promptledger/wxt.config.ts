import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'PromptLedger',
    description:
      'AI work audit log for agencies — capture prompts and outputs, export a client-ready trail.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'PromptLedger' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
