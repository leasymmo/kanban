import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'backdrop-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'modal-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'backdrop-in': 'backdrop-in 150ms ease-out both',
        'modal-in': 'modal-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'toast-in': 'toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'shake': 'shake 320ms ease-in-out both',
      },
      backgroundImage: {
        'gradient-to-r': 'linear-gradient(to right in oklch, var(--tw-gradient-stops))',
        'gradient-to-br': 'linear-gradient(to bottom right in oklch, var(--tw-gradient-stops))',
        'gradient-to-tr': 'linear-gradient(to top right in oklch, var(--tw-gradient-stops))',
      },
      colors: {
        brand: {
          50: 'oklch(0.97 0.015 255)',
          100: 'oklch(0.93 0.035 255)',
          500: 'oklch(0.62 0.190 260)',
          600: 'oklch(0.55 0.200 260)',
          700: 'oklch(0.49 0.190 260)',
          800: 'oklch(0.42 0.160 260)',
          900: 'oklch(0.36 0.130 260)',
        },
        blue: {
          ...colors.blue,
          500: 'oklch(0.62 0.190 260)',
          600: 'oklch(0.55 0.200 260)',
          700: 'oklch(0.49 0.190 260)',
        },
        indigo: {
          ...colors.indigo,
          500: 'oklch(0.62 0.190 277)',
          600: 'oklch(0.55 0.200 277)',
          700: 'oklch(0.49 0.190 277)',
        },
        violet: {
          ...colors.violet,
          500: 'oklch(0.62 0.190 293)',
          600: 'oklch(0.55 0.200 293)',
          700: 'oklch(0.49 0.190 293)',
        },
        purple: {
          ...colors.purple,
          500: 'oklch(0.62 0.190 304)',
          600: 'oklch(0.55 0.200 304)',
          700: 'oklch(0.49 0.190 304)',
        },
        emerald: {
          ...colors.emerald,
          500: 'oklch(0.62 0.130 162)',
          600: 'oklch(0.55 0.120 162)',
          700: 'oklch(0.49 0.110 162)',
        },
        teal: {
          ...colors.teal,
          500: 'oklch(0.62 0.105 180)',
          600: 'oklch(0.55 0.095 180)',
          700: 'oklch(0.49 0.090 180)',
        },
        amber: {
          ...colors.amber,
          500: 'oklch(0.62 0.145 55)',
          600: 'oklch(0.55 0.135 55)',
          700: 'oklch(0.49 0.120 55)',
        },
        red: {
          ...colors.red,
          500: 'oklch(0.62 0.190 27)',
          600: 'oklch(0.55 0.200 27)',
          700: 'oklch(0.49 0.190 27)',
        },
      }
    },
  },
  plugins: [],
}
