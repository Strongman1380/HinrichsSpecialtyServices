/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e8ff',
          500: '#1a78e6',
          600: '#1560c0',
          700: '#132e54',
          900: '#0a1f3a',
        },
        amber: {
          50:  '#fff8ed',
          100: '#fff0d4',
          200: '#ffddaa',
          300: '#ffc470',
          400: '#f5a623',
          500: '#f58220',
          600: '#e06c10',
          700: '#b85310',
          800: '#934215',
          900: '#783814',
          950: '#411b08',
        },
        blue: {
          50:  '#eef5ff',
          100: '#d9e8ff',
          200: '#bbdbff',
          300: '#8cc4ff',
          400: '#3ba6ff',
          500: '#1a78e6',
          600: '#1560c0',
          700: '#114b9c',
          800: '#133f81',
          900: '#132e54',
          950: '#0a1f3a',
        },
      },
    },
  },
  plugins: [],
}
