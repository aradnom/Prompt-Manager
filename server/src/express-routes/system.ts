import type { Express } from "express";

export function registerSystemRoutes(app: Express) {
  // ============================================================================
  // Health Check
  // ============================================================================

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
}
