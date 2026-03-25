/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        court: {
          50:  "#fff8ed",
          100: "#ffefd3",
          200: "#ffdba5",
          300: "#ffc06d",
          400: "#ff9a32",
          500: "#ff7c0a",
          600: "#f06000",
          700: "#c74602",
          800: "#9e370b",
          900: "#7f2f0c",
        },
        hardwood: {
          900: "#0f0e0c",
          800: "#1a1814",
          700: "#252219",
          600: "#3a3428",
          500: "#4a4334",
        },
        /** Warm neutrals tuned for readability on hardwood-800/900 (WCAG-friendly vs cool grays). */
        ink: {
          50: "#faf9f7",
          100: "#ece8e1",
          200: "#d4cfc6",
          300: "#b8b2a6",
          400: "#9c9589",
          500: "#827b70",
          600: "#6a645b",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "score-pop": "scorePop 0.3s ease forwards",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: "translateY(16px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        scorePop: {
          "0%":   { transform: "scale(1)" },
          "50%":  { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

