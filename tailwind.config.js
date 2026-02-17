/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js}",
  ],
  theme: {
    extend: {
      colors: {
        'youtube-red': '#ff0000',
        'youtube-dark': '#0f0f0f',
        'youtube-sidebar': '#212121',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}