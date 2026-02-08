import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: path.resolve(__dirname),
    include: ["tests/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    // Run tests sequentially to avoid rate limiting
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      "@server": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
});
