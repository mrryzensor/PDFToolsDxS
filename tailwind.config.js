/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface": "var(--color-surface, #faf8ff)",
        "surface-dim": "var(--color-surface-dim, #d2d9f4)",
        "surface-bright": "var(--color-surface-bright, #faf8ff)",
        "surface-container-lowest": "var(--color-surface-container-lowest, #ffffff)",
        "surface-container-low": "var(--color-surface-container-low, #f2f3ff)",
        "surface-container": "var(--color-surface-container, #eaedff)",
        "surface-container-high": "var(--color-surface-container-high, #e2e7ff)",
        "surface-container-highest": "var(--color-surface-container-highest, #dae2fd)",
        "surface-variant": "var(--color-surface-variant, #dae2fd)",
        "on-surface": "var(--color-on-surface, #131b2e)",
        "on-surface-variant": "var(--color-on-surface-variant, #434655)",
        "inverse-surface": "var(--color-inverse-surface, #283044)",
        "inverse-on-surface": "var(--color-inverse-on-surface, #eef0ff)",
        "outline": "var(--color-outline, #737686)",
        "outline-variant": "var(--color-outline-variant, #c3c6d7)",
        "surface-tint": "#0053db",
        "primary": "var(--color-primary, #004ac6)",
        "primary-container": "var(--color-primary-container, #2563eb)",
        "on-primary": "#ffffff",
        "on-primary-container": "#eeefff",
        "inverse-primary": "#b4c5ff",
        "secondary": "#855300",
        "secondary-container": "#fea619",
        "on-secondary": "#ffffff",
        "tertiary": "#ad0033",
        "tertiary-container": "#d22348",
        "on-tertiary": "#ffffff",
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "primary-fixed": "#dbe1ff",
        "on-primary-fixed": "#00174b"
      },
      fontFamily: {
        headline: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
      }
    },
  },
  plugins: [],
}
