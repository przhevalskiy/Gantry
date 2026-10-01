import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'PageSum',
    description:
      'Summarize the current page with your own OpenAI-compatible API key. Key stays on your device.',
    version: '0.2.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: 'PageSum' },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 96: '/icon/96.png', 128: '/icon/128.png' },
  },
});
