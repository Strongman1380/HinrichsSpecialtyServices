/** @type {import('tailwindcss').Config} */
const marcelo = require('./tailwind.marcelo');

module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './*.html',
  ],
  theme: {
    extend: {
      ...marcelo.theme.extend,
      // HSS specific overrides can go here
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
  ],
};