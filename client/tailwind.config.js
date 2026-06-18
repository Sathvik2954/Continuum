/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mist: {
          50: '#EDF0FB',
          100: '#C8D3F5',
          200: '#9AAEEE',
          400: '#6B87E0',
          600: '#3D5BC8',
          800: '#253A8A',
          900: '#111E50',
        },
        urgent: '#E24B4A',
        high: '#EF9F27',
        success: '#1D9E75',
        neutral: '#888780',
        info: '#6B87E0',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
