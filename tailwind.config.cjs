/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular"]
      },
      colors: {
        base: "#0a0c10",
        surface: "#111318",
        panel: "#0f141c",
        border: "#1e2330",
        bullish: "#00d4aa",
        bearish: "#ff4d6a",
        neutral: "#4d9fff",
        warning: "#f5a623",
        text: {
          primary: "#e8edf7",
          muted: "#98a2b3",
          subtle: "#778197"
        }
      },
      boxShadow: {
        panel: "0 8px 24px rgba(0, 0, 0, 0.24)"
      }
    }
  },
  plugins: []
};
