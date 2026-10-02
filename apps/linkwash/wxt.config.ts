import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'LinkWash',
    description: 'Strip tracking parameters from URLs when you copy them. 100% local.',
    version: '1.0.0',
    permissions: ['storage', 'contextMenus', 'activeTab', 'clipboardWrite'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: 'LinkWash' },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 96: '/icon/96.png', 128: '/icon/128.png' },
  },
});
