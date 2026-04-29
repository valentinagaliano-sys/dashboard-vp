import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6ff",
          500: "#3a5ad9",
          600: "#2f48b3",
          700: "#263a8e",
        },
      },
    },
  },
  plugins: [],
};
export default config;
