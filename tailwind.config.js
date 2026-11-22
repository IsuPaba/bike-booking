/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--re-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        line: v("border"),
        ink: { DEFAULT: v("ink"), soft: v("ink-soft") },
        primary: { DEFAULT: v("primary"), ink: "#FFFFFF" },
        cta: { DEFAULT: v("cta"), ink: v("cta-ink") },
        ride: v("ride"),
        tint: v("tint"),
        island: v("dark"),
        "on-dark-accent": v("on-dark-accent"),
        accent: v("accent"),
        // Status colours are shared by every palette so their meaning never changes
        status: {
          available: "#2D5A24",
          "available-bg": "#E2F0DC",
          low: "#7A4D00",
          "low-bg": "#FFF1D0",
          booked: "#5A5853",
          "booked-bg": "#ECEAE6",
          overdue: "#9A2E14",
          "overdue-bg": "#FCE3DC",
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Anton"', "Impact", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { "2xl": "1rem", "3xl": "1.5rem" },
      boxShadow: {
        soft: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(var(--re-ink) / 0.18)",
        lift: "0 2px 4px rgb(0 0 0 / 0.05), 0 18px 40px -16px rgb(var(--re-ink) / 0.28)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { "fade-up": "fade-up .25s ease-out", "fade-in": "fade-in .2s ease-out" },
    },
  },
  plugins: [],
};
