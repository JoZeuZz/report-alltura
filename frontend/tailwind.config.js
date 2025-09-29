/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#2A64A4', // Azul Primario (Acciones)
        'dark-blue': '#1E2A4A',    // Azul Oscuro (Fondos/Texto)
        'neutral-gray': '#6B7280', // Gris Neutro (Secundario)
        'light-gray-bg': '#F9FAFB' // Fondo Principal Claro
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
