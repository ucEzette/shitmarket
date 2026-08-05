import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        trench: {
          black: "#0D0D0A",
          mud: "#2A241A",
          sandbag: "#5C5244",
          gasmask: "#8B8B7A",
        },
        neon: {
          moon: "#39FF14",
        },
        jeet: {
          red: "#FF073A",
        },
        moon: {
          gold: "#FFD700",
        },
        light: {
          bg: "#A8EEFF",
          card: "#FFFFFF",
          secondary: "#F0FAFE",
          text: "#0A1A2A",
          muted: "#2C3E50",
          moon: "#00796B",
          jeet: "#C62828",
          gold: "#F4A261",
          border: "#B2EBF2",
          inputBg: "#FFFFFF",
          inputText: "#4A4A4A",
          inputBorder: "#B0BEC5",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card-bg)",
        cardBorder: "var(--border-color)",
        primaryText: "var(--text-primary)",
        secondaryText: "var(--text-secondary)",
      },
      fontFamily: {
        staatliches: ["var(--font-staatliches)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        marker: ["var(--font-permanent-marker)", "cursive"],
        anybody: ["var(--font-anybody)", "sans-serif"],
        space: ["var(--font-space-mono)", "monospace"],
        syne: ["var(--font-syne)", "sans-serif"],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
