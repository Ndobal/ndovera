/** @type {import('tailwindcss').Config} */
module.exports = {
  // The app toggles a `.dark` class on <html>, so Tailwind dark: utilities must be class-driven
  // (not the default 'media'/OS preference) for the toggle to control them.
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      animation: {
        'spin-reverse': 'spin-reverse 1s linear infinite',
      },
      keyframes: {
        'spin-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
      },
    },
  },
  plugins: [],
}
