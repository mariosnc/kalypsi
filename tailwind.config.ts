import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EEF0EA",
        ink: "#1E2A22",
        teal: "#2F6F5E",
        amber: "#C97A2E",
        brick: "#A8453A",
      },
      fontFamily: {
        disp: ["Fraunces", "serif"],
        body: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
