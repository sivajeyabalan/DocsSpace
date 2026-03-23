import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        docspace: {
          50: '#eff9ff',
          100: '#d8efff',
          500: '#1587c9',
          700: '#0e5b92',
        },
        ink: {
          900: '#102334',
        },
      },
      borderRadius: {
        card: '1rem',
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'Inter', 'sans-serif'],
      },
    },
  },
} satisfies Config;
