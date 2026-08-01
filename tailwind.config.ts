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
          black: "#05050A",
          mud: "#0F1016",
          sandbag: "#1E222D",
          gasmask: "#94A3B8",
        },
        neon: {
          moon: "#16A34A", // Darker toxic green matching the logo
        },
        jeet: {
          red: "#FF2A4D", // More vibrant, less harsh red
        },
        moon: {
          gold: "#FBBF24", // Premium amber/gold
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
