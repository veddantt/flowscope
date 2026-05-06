/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        compact: '0px',
        medium: '768px',
        expanded: '1024px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.05), 0 10px 40px rgba(0,0,0,0.35)',
      },
      keyframes: {
        pulseLine: {
          '0%, 100%': { opacity: '0.28' },
          '50%': { opacity: '0.95' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        pulseLine: 'pulseLine 1.8s ease-in-out infinite',
        floatSlow: 'floatSlow 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
