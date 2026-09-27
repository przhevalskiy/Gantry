import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'BidMatch',
    description:
      'Highlight RFP and job-board keywords that match your saved searches — USAJobs, SAM.gov, and more.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: [
      'https://www.usajobs.gov/*',
      'https://sam.gov/*',
      'https://*.sam.gov/*',
      'https://www.indeed.com/*',
      'https://www.linkedin.com/jobs/*',
      '<all_urls>',
    ],
    action: { default_title: 'BidMatch' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
