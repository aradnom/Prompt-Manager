import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverUrl = env.SERVER_URL || "http://localhost:3001";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@server": path.resolve(__dirname, "./server/src"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
    server: {
      proxy: {
        "/trpc": {
          target: serverUrl,
          changeOrigin: true,
        },
        "/api": {
          target: serverUrl,
          changeOrigin: true,
          ws: true,
        },
      },
      allowedHosts: [new URL("http://prompt-manager:3001").hostname],
    },
  };
});
