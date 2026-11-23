/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    transparent: "transparent",
    current: "currentColor",
    extend: {
      colors: {
        gray: {
          50: "#F7FAFC",
          900: "#171923",
        },
        orange: {
          500: "#ff8b1a",
        },
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.06)",
      },
      borderRadius: {
        xs: "0.125rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      spacing: {
        4.5: "1.125rem",
        6.5: "1.625rem",
        13: "3.25rem",
      },
      fontFamily: {
        sans: ["'Open Sans'", "system-ui", "sans-serif"],
        body: ["'Open Sans'", "system-ui", "sans-serif"],
        display: ["'Outfit'", "'Open Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@headlessui/tailwindcss")],
};
