import type { Config } from "tailwindcss";

/**
 * Semantic palette mapped to CSS variables owned by @supportai/ui tokens.
 * Components use classes like bg-surface / text-fg-muted / border-border.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--fg)",
        secondary: { DEFAULT: "var(--surface-alt)", foreground: "var(--fg)" },
        muted: { DEFAULT: "var(--surface-alt)", foreground: "var(--fg-muted)" },
        card: { DEFAULT: "var(--surface)", foreground: "var(--fg)" },
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          alt: "var(--surface-alt)",
          hover: "var(--surface-hover)",
        },
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        fg: {
          DEFAULT: "var(--fg)",
          secondary: "var(--fg-secondary)",
          muted: "var(--fg-muted)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          strong: "var(--primary-strong)",
          soft: "var(--primary-soft)",
          fg: "var(--primary-fg)",
          foreground: "var(--primary-fg)",
        },
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: {
          DEFAULT: "var(--danger)",
          strong: "var(--danger-strong)",
          soft: "var(--danger-soft)",
        },
        violet: "var(--violet)",
        orange: "var(--orange)",
      },
      borderRadius: {
        xl: "20px",
        "2xl": "28px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(2 6 16 / 0.32)",
        pop: "0 12px 28px -6px rgb(2 6 16 / 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
