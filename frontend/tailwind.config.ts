import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        
        ink: {
          50:  "rgb(var(--ink-50)  / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          950: "rgb(var(--ink-950) / <alpha-value>)",
        },
        nova: {
          300: "rgb(var(--nova-300) / <alpha-value>)",
          400: "rgb(var(--nova-400) / <alpha-value>)",
          500: "rgb(var(--nova-500) / <alpha-value>)",
          600: "rgb(var(--nova-600) / <alpha-value>)",
          700: "rgb(var(--nova-700) / <alpha-value>)",
          800: "rgb(var(--nova-800) / <alpha-value>)",
          900: "rgb(var(--nova-900) / <alpha-value>)",
          950: "rgb(var(--nova-950) / <alpha-value>)",
        },
        accent: {
          cyan: "rgb(var(--accent-cyan) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body:    ["var(--font-body)",    "sans-serif"],
        mono:    ["var(--font-mono)",    "monospace"],
      },
      boxShadow: {
        "nova-sm": "0 0 0 1px rgba(var(--nova-500),0.2), 0 4px 16px rgba(var(--nova-500),0.12)",
        "nova-md": "0 0 0 1px rgba(var(--nova-500),0.25), 0 8px 32px rgba(var(--nova-500),0.2)",
        "nova-lg": "0 0 0 1px rgba(var(--nova-500),0.3), 0 16px 48px rgba(var(--nova-500),0.25)",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        blink:   "blink 1s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;