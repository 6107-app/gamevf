import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coral:    "#FF7B6B",
        cream:    "#FDF8F0",
        brown:    "#5C3D2E",
        bronze:   "#C8956C",
        silver:   "#A8B8C8",
        gold:     "#E8C547",
        diamond:  "#B39DDB",
        mint:     "#E8F5E9",
      },
      fontFamily: {
        main:  ["Nunito", "sans-serif"],
        serif: ["Noto Serif SC", "serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};

export default config;