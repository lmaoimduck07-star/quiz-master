/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E3A8A',
        },
        accent: {
          danger: '#DC2626',
          success: '#16A34A',
          warning: '#D97706',
        },
        background: {
          DEFAULT: '#F8FAFC',
          card: '#FFFFFF',
        }
      },
      borderRadius: {
        'md': '6px',
        'lg': '8px',
      }
    },
  },
  plugins: [],
}
