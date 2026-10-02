import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'TabSleep',
    description: 'Suspend idle tabs to save memory. Save and restore named browser sessions.',
    version: '1.0.0',
    permissions: ['storage', 'tabs', 'alarms'],
    action: { default_title: 'TabSleep' },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 96: '/icon/96.png', 128: '/icon/128.png' },
  },
});
