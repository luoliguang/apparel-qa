/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        nav: '0 8px 30px rgba(2, 6, 23, 0.35)',
      },
    },
  },
  plugins: [],
};
