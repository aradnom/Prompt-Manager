import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@server": path.resolve(__dirname, "./server/src"),
    },
  },
  server: {
    proxy: {
      "/trpc": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
