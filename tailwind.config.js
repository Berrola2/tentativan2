/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36a9f6',
          500: '#0c8de4',
          600: '#016ec2',
          700: '#02589e',
          800: '#064b82',
          900: '#0b3f6d',
          950: '#072848',
        },
        corporate: {
          slate: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          gold: '#d97706',
          emerald: '#059669',
          ruby: '#e11d48',
          amber: '#d97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'card-hover': '0 12px 30px -10px rgba(0, 110, 194, 0.25)',
      }
    },
  },
  plugins: [],
}
