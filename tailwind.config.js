// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#FFF7F4",
          100: "#F9E9E2",
          200: "#F1D8CD",
          300: "#EFD4C4", // 🎨 ta 3e couleur
          400: "#D9A5AE",
          500: "#C57E86",
          600: "#AC5B67", // 🎨 ta 2e couleur
          700: "#7B2E3E",
          800: "#5E1427",
          900: "#4E0714", // 🎨 ta 1re couleur
        },
      },
      boxShadow: {
        soft: "0 8px 24px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
