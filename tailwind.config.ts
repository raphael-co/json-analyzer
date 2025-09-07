import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)"],
      },
      colors: {
        brand: {
          DEFAULT: "#2563eb",
          fg: "#ffffff",
        }
      },
      backgroundImage: {
        'grid': "radial-gradient(currentColor 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid': "24px 24px",
      },
    },
  },
  plugins: [],
} satisfies Config;
