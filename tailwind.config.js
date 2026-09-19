/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: '#F5F5F5',
        stroke: '#E4E4E4',
        ink: '#171717',
        muted: '#737373',
        accent: '#171717',
        correct: '#2F8A4E',
        incorrect: '#C44747',
        caution: '#B5811A',
      },
    },
  },
  plugins: [],
};
