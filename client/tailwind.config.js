/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        cream: {
          50:  '#FEF9F0',
          100: '#FDF0D5',
          200: '#FAEAB8',
          300: '#F5D78A',
          400: '#E8C060',
          600: '#C49A38',
          800: '#7A5C14',
        },
        sky: {
          50:  '#E0F5FF',
          100: '#BAE8FF',
          200: '#7DD4F8',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          900: '#0C4A6E',
        },
        // Semantic medical colors
        urgent: {
          DEFAULT: '#EF4444',
          text:    '#991B1B',
          bg:      'rgba(239,68,68,0.16)',
        },
        high: {
          DEFAULT: '#F59E0B',
          text:    '#78350F',
          bg:      'rgba(245,158,11,0.16)',
        },
        success: {
          DEFAULT: '#10B981',
          text:    '#065F46',
          bg:      'rgba(16,185,129,0.16)',
        },
        live: {
          DEFAULT: '#06B6D4',
          text:    '#0E7490',
          bg:      'rgba(6,182,212,0.16)',
        },
      },
      borderRadius: {
        xs:   '4px',
        sm:   '8px',
        md:   '10px',
        lg:   '14px',
        xl:   '16px',
        pill: '20px',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.5', transform: 'scale(0.92)' },
        },
        'pulse-fast': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.3' },
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'pulse-fast': 'pulse-fast 0.8s ease-in-out infinite',
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
