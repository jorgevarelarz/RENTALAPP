/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#111827',
        'primary-hover': '#0B1220',
        success: '#16A34A',
        warning: '#EA580C',
        error: '#B91C1C',
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
  },
  plugins: [],
};

