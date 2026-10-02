import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'MediaBoost',
    description: 'Playback speed and volume boost for HTML5 video and audio on any site.',
    version: '1.0.0',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: 'MediaBoost' },
    commands: {
      'speed-up': { suggested_key: { default: 'Alt+Shift+Right' }, description: 'Speed up' },
      'speed-down': { suggested_key: { default: 'Alt+Shift+Left' }, description: 'Slow down' },
      'boost-toggle': { suggested_key: { default: 'Alt+Shift+Up' }, description: 'Toggle volume boost' },
    },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 96: '/icon/96.png', 128: '/icon/128.png' },
  },
});
