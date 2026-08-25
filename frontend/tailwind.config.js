/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta Azoramind
        brand: {
          50:  '#EFF4FF',
          100: '#DBE7FE',
          200: '#BFD3FE',
          300: '#93B4FD',
          400: '#6089FA',
          500: '#3B65F5',
          600: '#1E40AF', // primary
          700: '#1E3A8A',
          800: '#1E3170',
          900: '#1B2A5C',
        },
        gold: {
          400: '#F5C542',
          500: '#D9A518',
          600: '#B8860B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.06)',
        elevated: '0 10px 30px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
