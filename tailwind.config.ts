import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#FAFBFD",
        surface: { DEFAULT: "#FFFFFF", hover: "#F1F5F9" },
        accent: {
          DEFAULT: "#0C8E70",
          soft: "rgba(12,142,112,0.08)",
          soft2: "rgba(12,142,112,0.16)",
          hover: "#0A7D63",
        },
        text: { DEFAULT: "#1E293B", muted: "#64748B", dim: "#94A3B8" },
        border: "#E2E8F0",
        success: { DEFAULT: "#22C55E", soft: "rgba(34,197,94,0.12)" },
        warning: { DEFAULT: "#F59E0B", soft: "rgba(245,158,11,0.12)" },
        error: { DEFAULT: "#EF4444", soft: "rgba(239,68,68,0.12)" },
        info: { DEFAULT: "#3B82F6", soft: "rgba(59,130,246,0.12)" },
        scrim: "rgba(15,23,42,0.5)",
      },
      fontFamily: {
        sans: ["var(--sans)", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        serif: ["var(--serif)", "Georgia", "serif"],
        mono: ["var(--mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.14)",
        card: "0 1px 2px rgba(15,23,42,0.06)",
        float: "0 8px 24px -6px rgba(15,23,42,0.2)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
