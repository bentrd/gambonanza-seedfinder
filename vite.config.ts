import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "1" ? "/gambonanza-seedfinder/" : "/",
  plugins: [react(), tailwindcss(), wasm()],
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  build: {
    target: "es2022",
  },
});
