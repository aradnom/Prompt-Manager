import type { Express, Request, Response } from "express";
import type { PostgresStorageAdapter } from "@server/adapters/postgres-adapter";
import { validateAPIKey, hashToken } from "@server/lib/auth";
import type { ServerConfig } from "@server/config";

// SSE connection manager
const sseClients = new Map<number, Set<Response>>();

export function notifyStackUpdate(
  userId: number,
  displayId: string,
  renderedContent: string,
) {
  const clients = sseClients.get(userId);
  if (clients) {
    const payload = JSON.stringify({
      display_id: displayId,
      prompt: renderedContent,
    });
    clients.forEach((client) => {
      client.write(`data: ${payload}\n\n`);
    });
  }
}

// Middleware to authenticate ComfyUI requests
async function authenticateComfyUI(
  req: Request,
  res: Response,
  storage: PostgresStorageAdapter,
  tokenSecret: string,
): Promise<number | null> {
  let token: string | undefined;

  // Try to get token from Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  // If not in header, try query string (for SSE)
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({
      error:
        "Authentication required. Provide token via Authorization header or query string.",
    });
    return null;
  }

  // Validate the token
  if (!validateAPIKey(token)) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }

  // Get user ID by API key hash
  const keyHash = hashToken(token, tokenSecret);
  const userId = await storage.getUserIdByApiKey(keyHash);
  if (!userId) {
    res.status(401).json({ error: "Token not associated with any user" });
    return null;
  }

  return userId;
}

export function registerIntegrationRoutes(
  app: Express,
  storage: PostgresStorageAdapter,
  config: ServerConfig,
) {
  // ============================================================================
  // ComfyUI Integration Endpoints
  // ============================================================================

  app.get("/api/integrations/comfyui/prompts/list", async (req, res) => {
    try {
      const userId = await authenticateComfyUI(
        req,
        res,
        storage,
        config.tokenSecret,
      );
      if (userId === null) return;

      const stacks = await storage.listStacks(userId);
      const displayIds = stacks.map((stack) => stack.displayId);

      res.json({ prompts: displayIds });
    } catch (error) {
      console.error("Error fetching prompts for ComfyUI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/integrations/comfyui/prompts/get/raw", async (req, res) => {
    try {
      const userId = await authenticateComfyUI(
        req,
        res,
        storage,
        config.tokenSecret,
      );
      if (userId === null) return;

      const displayId = req.query.display_id as string;

      if (!displayId) {
        return res
          .status(400)
          .json({ error: "display_id query parameter is required" });
      }

      const prompt = await storage.getCompiledPrompt(displayId, userId);

      if (prompt === null) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      res.json({ prompt });
    } catch (error) {
      console.error("Error fetching raw prompt content for ComfyUI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/integrations/comfyui/prompts/get", async (req, res) => {
    try {
      const userId = await authenticateComfyUI(
        req,
        res,
        storage,
        config.tokenSecret,
      );
      if (userId === null) return;

      const displayId = req.query.display_id as string;

      if (!displayId) {
        return res
          .status(400)
          .json({ error: "display_id query parameter is required" });
      }

      const prompt = await storage.getRenderedPrompt(displayId, userId);

      if (prompt === null) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      res.json({ prompt });
    } catch (error) {
      console.error(
        "Error fetching rendered prompt content for ComfyUI:",
        error,
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // SSE endpoint for ComfyUI integration
  app.get("/api/integrations/comfyui/events", async (req, res) => {
    const userId = await authenticateComfyUI(
      req,
      res,
      storage,
      config.tokenSecret,
    );
    if (userId === null) return;

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Add client to the set for this user
    if (!sseClients.has(userId)) {
      sseClients.set(userId, new Set());
    }
    sseClients.get(userId)!.add(res);

    console.debug(`SSE client connected for user ${userId}`);

    // Send initial connection message
    res.write('data: {"connected": true}\n\n');

    // Handle client disconnect
    req.on("close", () => {
      const clients = sseClients.get(userId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          sseClients.delete(userId);
        }
      }
      console.debug(`SSE client disconnected for user ${userId}`);
    });
  });
}
