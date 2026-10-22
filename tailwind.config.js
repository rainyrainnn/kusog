/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // KUSOG environmental monitoring palette
        base: {
          950: '#061321',
          900: '#081a2b',
          850: '#0b2034',
          800: '#102a43',
          750: '#15334d',
          700: '#1b3d58',
          600: '#28516b',
          500: '#52748a',
        },
        accent: {
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        ok: {
          400: '#5ee0b0',
          500: '#10b981',
          600: '#059669',
        },
        warn: {
          400: '#fbbf24',
          500: '#d99a20',
        },
        danger: {
          400: '#fb7185',
          500: '#e5485d',
          600: '#be3447',
        },
        slate: {
          50: '#f7fbff',
          100: '#e8f1f8',
          200: '#d4e2ee',
          300: '#b4c9d8',
          400: '#93adbf',
          500: '#7792a6',
          600: '#607b90',
          700: '#48657a',
          800: '#2d4b61',
          900: '#17344b',
          950: '#0b2034',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 0 1px rgba(22,140,140,0.14)',
        'glow-ok': '0 0 0 1px rgba(47,133,90,0.14)',
        'glow-danger': '0 0 0 1px rgba(192,57,43,0.14)',
        panel: '0 8px 24px rgba(0,8,18,0.24)',
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
