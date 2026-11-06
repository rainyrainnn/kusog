/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0B1220',
          900: '#111C30',
          850: '#17243A',
          800: '#17243A',
          750: '#1D2B42',
          700: '#26364D',
          600: '#3A4A62',
          500: '#64748B',
        },
        accent: {
          100: '#CFF4FF',
          200: '#9CEAFF',
          300: '#67DFFF',
          400: '#00C8FF',
          500: '#00B3E6',
          600: '#0096C7',
        },
        accentSecondary: {
          400: '#00D6A0',
          500: '#00B887',
        },
        ok: {
          300: '#65E6C1',
          400: '#00D6A0',
          500: '#16A34A',
          600: '#15803D',
        },
        warn: {
          400: '#F59E0B',
          500: '#D97706',
        },
        danger: {
          400: '#EF4444',
          500: '#DC2626',
          600: '#B91C1C',
        },
        info: {
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
        },
        slate: {
          50: '#F5F8FC',
          100: '#F5F8FC',
          200: '#D7E0ED',
          300: '#94A3B8',
          400: '#94A3B8',
          500: '#77869B',
          600: '#607089',
          700: '#45556F',
          800: '#26364D',
          900: '#17243A',
          950: '#0B1220',
        },
        sky: {
          200: '#26364D',
          300: '#35465E',
          400: '#00C8FF',
          500: '#0EA5E9',
          600: '#0284C7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 0 1px rgba(0,200,255,0.18)',
        'glow-ok': '0 0 0 1px rgba(0,214,160,0.14)',
        'glow-danger': '0 0 0 1px rgba(239,68,68,0.14)',
        panel: '0 12px 30px rgba(2,8,20,0.32), inset 0 1px 0 rgba(255,255,255,0.025)',
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
