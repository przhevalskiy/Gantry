import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'SlackSpaceMark',
    description: 'Color-label which Slack workspace you are in.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'activeTab', 'scripting'],
    host_permissions: [
      'https://app.slack.com/*'
    ],
    action: { default_title: 'SlackSpaceMark' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
