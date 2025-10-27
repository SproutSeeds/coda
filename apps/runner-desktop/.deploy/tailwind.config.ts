import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/renderer/**/*.{ts,tsx,html}",
    "../../components/**/*.{ts,tsx}",
    "../../app/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  darkMode: ["class"],
};

export default config;
