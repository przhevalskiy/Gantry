import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'BannerAway',
    description: 'Automatically dismiss cookie and consent banners that block the page.',
    version: '1.0.0',
    permissions: ['storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: 'BannerAway' },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 96: '/icon/96.png', 128: '/icon/128.png' },
  },
});
