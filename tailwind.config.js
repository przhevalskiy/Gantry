/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Navy palette – primary brand colour for a legal company
        navy: {
          50:  '#eef2f9',
          100: '#d5dff0',
          200: '#adbfe1',
          300: '#7a96cc',
          400: '#4f6eb8',
          500: '#2f4f9e',
          600: '#243d80',
          700: '#1b2e62',
          800: '#122044',
          900: '#0b1428',
          950: '#060b18',
        },
        // Gold palette – accent colour for headings, badges, and CTAs
        gold: {
          50:  '#fdfaee',
          100: '#faf3d2',
          200: '#f5e49f',
          300: '#eece5e',
          400: '#e8b93a',
          500: '#d4a017',
          600: '#b07d10',
          700: '#895d0f',
          800: '#6b4710',
          900: '#583b12',
          950: '#321f05',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px 0 rgba(11,20,40,0.10)',
        'card-hover': '0 6px 24px 0 rgba(11,20,40,0.18)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
