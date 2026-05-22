import type { Config } from "tailwindcss";

const config: Config = {
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
          moon: "#00FF66", // Slightly sleeker neon green
        },
        jeet: {
          red: "#FF2A4D", // More vibrant, less harsh red
        },
        moon: {
          gold: "#FBBF24", // Premium amber/gold
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
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
