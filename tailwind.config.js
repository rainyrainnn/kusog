/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep blue/grey control center palette
        base: {
          900: '#070b14',
          850: '#0a0f1c',
          800: '#0d1424',
          750: '#111a2e',
          700: '#162038',
          600: '#1c2942',
          500: '#243352',
        },
        accent: {
          // Electric blue
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        ok: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
        warn: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 0 1px rgba(14,165,233,0.4), 0 0 24px -6px rgba(14,165,233,0.45)',
        'glow-ok': '0 0 0 1px rgba(34,197,94,0.4), 0 0 24px -6px rgba(34,197,94,0.45)',
        'glow-danger': '0 0 0 1px rgba(239,68,68,0.4), 0 0 24px -6px rgba(239,68,68,0.45)',
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 30px -12px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'fadeIn': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'rain-fall': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '10%': { opacity: '0.8' },
          '100%': { transform: 'translateY(400%)', opacity: '0' },
        },
        'spray': {
          '0%': { transform: 'translateX(0) scaleX(0.6)', opacity: '0.9' },
          '100%': { transform: 'translateX(120%) scaleX(1.4)', opacity: '0' },
        },
        'fan-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'scan': 'scan 4s linear infinite',
        'rain-fall': 'rain-fall 0.8s linear infinite',
        'spray': 'spray 1.2s ease-out infinite',
        'fan-spin': 'fan-spin 1s linear infinite',
      },
    },
  },
  plugins: [],
};
