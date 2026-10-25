import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        rose: {
          50: '#fdf2f5',
          100: '#fce7ed',
          200: '#f9d0dc',
          300: '#f4a8bd',
          400: '#ec7598',
          500: '#df4a78',
          600: '#c92c5e',
          700: '#a91f4c',
          800: '#8d1c43',
          900: '#781a3d',
        },
        sage: {
          50: '#f3f8f3',
          100: '#e3efe4',
          200: '#c8dfca',
          300: '#9fc6a3',
          400: '#71a677',
          500: '#4f8956',
          600: '#3c6d43',
          700: '#315737',
          800: '#2a462e',
          900: '#233a27',
        },
        sand: {
          50: '#fbf8f1',
          100: '#f5efdf',
          200: '#eadcbc',
          300: '#ddc392',
          400: '#cfa567',
          500: '#c48f4a',
          600: '#b6793f',
          700: '#976036',
          800: '#7a4e31',
          900: '#64412a',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgb(20 10 15 / 0.04), 0 8px 24px -12px rgb(20 10 15 / 0.12)',
        lift: '0 2px 4px rgb(20 10 15 / 0.06), 0 16px 40px -16px rgb(20 10 15 / 0.2)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config
