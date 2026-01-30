import type { Express, RequestHandler } from "express";
import type { PostgresStorageAdapter } from "@server/adapters/postgres-adapter";
import type { ServerConfig } from "@server/config";
import {
  generateToken,
  hashToken,
  encryptAccountData,
  decryptAccountData,
  generateSessionKey,
  encryptDerivedKey,
  deriveEncryptionKey,
  decrypt,
  encrypt,
} from "@server/lib/auth";
import { withDerivedKey } from "@server/middleware/account-data";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import "express-session"; // Required for session type augmentation

interface ProviderApiKeyConfig {
  key: string;
  model?: string;
}

type ApiKeysMap = Record<string, ProviderApiKeyConfig>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Invalid API key or insufficient permissions";
}

export function registerAuthRoutes(
  app: Express,
  storage: PostgresStorageAdapter,
  config: ServerConfig,
  rateLimitMiddleware?: RequestHandler,
) {
  // Build middleware chain for rate-limited routes
  const rateLimited: RequestHandler[] = rateLimitMiddleware
    ? [rateLimitMiddleware]
    : [];
  // ============================================================================
  // Authentication Endpoints
  // ============================================================================

  // Register new account - generates token, creates user, establishes session
  app.post("/api/auth/register", ...rateLimited, async (req, res) => {
    try {
      // Generate new token
      const token = generateToken();

      // Hash token for database lookup (HMAC-SHA256 - deterministic)
      const tokenHash = hashToken(token, config.tokenSecret);

      // Create account data with encrypted fields
      const accountData = await encryptAccountData(
        {
          token, // Store plaintext token encrypted so user can retrieve it later
        },
        token,
        config.encryptionSalt,
      );

      // Create user in database
      const user = await storage.createUser({
        tokenHash,
        accountData,
      });

      // Generate session encryption key
      const sessionKey = generateSessionKey();

      // Derive the encryption key from the token
      const derivedKey = await deriveEncryptionKey(
        token,
        config.encryptionSalt,
      );

      // Encrypt the derived key with the session key and store in session
      const encryptedDerivedKey = encryptDerivedKey(derivedKey, sessionKey);

      // Establish session with encrypted derived key
      req.session.userId = user.id;
      req.session.encryptedDerivedKey = encryptedDerivedKey;

      // Send session key in httpOnly cookie
      res.cookie("sessionKey", sessionKey, {
        httpOnly: true,
        secure: config.nodeEnv !== "development",
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });

      console.debug(`Created new user account: ${user.id}`);

      // Return plaintext token to user (only time they'll see it unless they log in)
      res.json({ token });
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // Login - authenticates token, establishes session, returns decrypted account data
  app.post("/api/auth/login", ...rateLimited, async (req, res) => {
    try {
      const { token } = req.body ?? {};

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token is required" });
      }

      // Hash the provided token to look up the user (HMAC-SHA256 - deterministic)
      const tokenHash = hashToken(token, config.tokenSecret);

      // Find user by token hash
      const user = await storage.getUserByTokenHash(tokenHash);

      if (!user) {
        console.debug("Unable to find user for passed token");
        return res.status(401).json({ error: "Invalid token" });
      }

      // Decrypt account data using the token
      if (!user.accountData) {
        console.debug("Unable to decrypt user account data");

        return res.status(500).json({ error: "Account data not found" });
      }

      const decryptedData = await decryptAccountData(
        user.accountData,
        token,
        config.encryptionSalt,
      );

      // Generate session encryption key
      const sessionKey = generateSessionKey();

      // Derive the encryption key from the token
      const derivedKey = await deriveEncryptionKey(
        token,
        config.encryptionSalt,
      );

      // Encrypt the derived key with the session key and store in session
      const encryptedDerivedKey = encryptDerivedKey(derivedKey, sessionKey);

      // Establish session with encrypted derived key
      req.session.userId = user.id;
      req.session.encryptedDerivedKey = encryptedDerivedKey;

      // Send session key in httpOnly cookie
      res.cookie("sessionKey", sessionKey, {
        httpOnly: true,
        secure: config.nodeEnv !== "development",
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });

      console.debug(`User logged in: ${user.id}`);

      // Return decrypted account data so user can view their token
      res.json({ accountData: decryptedData });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  // Logout - destroys session
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const userId = req.session.userId;

      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ error: "Failed to log out" });
        }

        // Clear the session key cookie
        res.clearCookie("sessionKey");
        res.clearCookie("connect.sid");

        if (userId) {
          console.debug(`User logged out: ${userId}`);
        }

        res.json({ success: true });
      });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ error: "Failed to log out" });
    }
  });

  // Get current session status
  app.get("/api/auth/session", async (req, res) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.json({ authenticated: false });
      }

      const user = await storage.getUserById(userId);
      res.json({
        authenticated: true,
        userId,
        adminUser: user?.adminUser ?? false,
      });
    } catch (error) {
      console.error("Error checking session:", error);
      res.status(500).json({ error: "Failed to check session" });
    }
  });

  // Get account data (requires authenticated session with sessionKey cookie)
  app.get("/api/auth/account", withDerivedKey, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get user from database
      const user = await storage.getUserById(userId);
      if (!user || !user.accountData) {
        return res
          .status(404)
          .json({ error: "User or account data not found" });
      }

      // Decrypt account data using the derived key from middleware
      const derivedKey = req.derivedKey!;
      const decryptedData: Record<string, string> = {};

      for (const [field, encryptedValue] of Object.entries(user.accountData)) {
        // Skip apiKeys field - we'll handle it separately
        if (field === "apiKeys") continue;
        decryptedData[field] = decrypt(encryptedValue, derivedKey);
      }

      // Check which API keys are configured and return model info (without exposing the actual keys)
      // Initialize with all allowed targets
      const apiKeyInfo: Record<
        string,
        { configured: boolean; model?: string }
      > = {};
      for (const target of config.llm.allowedTargets) {
        apiKeyInfo[target] = { configured: false };
      }

      if (user.accountData.apiKeys) {
        try {
          const decryptedApiKeys = decrypt(
            user.accountData.apiKeys as string,
            derivedKey,
          );
          const apiKeys = JSON.parse(decryptedApiKeys) as ApiKeysMap;

          // Set configuration status and model for each provider
          for (const provider of Object.keys(apiKeyInfo)) {
            const providerData = apiKeys[provider];
            if (providerData?.key) {
              apiKeyInfo[provider] = {
                configured: true,
                model: providerData.model,
              };
            }
          }
        } catch (error) {
          console.error("Error decrypting API keys for flags:", error);
          // Leave all as unconfigured if decryption fails
        }
      }

      res.json({ accountData: decryptedData, apiKeys: apiKeyInfo });
    } catch (error) {
      console.error("Error fetching account data:", error);
      res.status(500).json({ error: "Failed to fetch account data" });
    }
  });

  // Save API keys (encrypted in account_data.apiKeys)
  app.post("/api/auth/api-keys", withDerivedKey, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { provider, apiKey, model } = req.body;
      if (!provider) {
        return res.status(400).json({ error: "Provider is required" });
      }

      // Valid providers from config
      if (!config.llm.allowedTargets.has(provider)) {
        return res.status(400).json({ error: "Invalid provider" });
      }

      // Get user from database
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get current account data (already encrypted)
      const currentAccountData: Record<string, string> = user.accountData || {};

      // Decrypt apiKeys field if it exists
      const derivedKey = req.derivedKey!;
      let apiKeys: ApiKeysMap = {};

      if (currentAccountData.apiKeys) {
        try {
          const decryptedApiKeys = decrypt(
            currentAccountData.apiKeys,
            derivedKey,
          );
          apiKeys = JSON.parse(decryptedApiKeys) as ApiKeysMap;
        } catch (error) {
          console.error("Error decrypting existing API keys:", error);
          // If decryption fails, start fresh
          apiKeys = {};
        }
      }

      // Check if we're updating an existing provider or creating new
      const existingProvider = apiKeys[provider];

      // If apiKey is '__PRESERVE__', keep the existing key (for model-only updates)
      if (apiKey === "__PRESERVE__" && existingProvider?.key) {
        // Just update the model, preserve the key
        apiKeys[provider] = {
          key: existingProvider.key,
          ...(model && { model }),
        };
      } else if (apiKey) {
        // Update or set new API key
        apiKeys[provider] = {
          key: apiKey,
          ...(model && { model }),
        };
      } else {
        return res
          .status(400)
          .json({ error: "apiKey is required for new configurations" });
      }

      // Encrypt the updated apiKeys object
      const encryptedApiKeys = encrypt(JSON.stringify(apiKeys), derivedKey);

      // Update account data with encrypted apiKeys
      const updatedAccountData: Record<string, string> = {
        ...currentAccountData,
        apiKeys: encryptedApiKeys,
      };

      // If activeLLMPlatform is not set, set it to this provider
      if (!currentAccountData.activeLLMPlatform) {
        updatedAccountData.activeLLMPlatform = encrypt(provider, derivedKey);
      }

      // Update user in database
      await storage.updateUserAccountData(userId, updatedAccountData);

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving API key:", error);
      res.status(500).json({ error: "Failed to save API key" });
    }
  });

  // Set active LLM platform
  app.post("/api/auth/active-platform", withDerivedKey, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { platform } = req.body;
      if (!platform) {
        return res.status(400).json({ error: "Platform is required" });
      }

      // Valid platforms from config, plus client-only targets
      const clientOnlyTargets = ["transformers-js", "lm-studio"];
      if (
        !config.llm.allowedTargets.has(platform) &&
        !clientOnlyTargets.includes(platform)
      ) {
        return res.status(400).json({ error: "Invalid platform" });
      }

      // Get user from database
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get current account data (already encrypted)
      const currentAccountData = user.accountData || {};

      // Encrypt the active platform value
      const derivedKey = req.derivedKey!;
      const encryptedPlatform = encrypt(platform, derivedKey);

      // Update account data with active platform
      const updatedAccountData = {
        ...currentAccountData,
        activeLLMPlatform: encryptedPlatform,
      };

      // Update user in database
      await storage.updateUserAccountData(userId, updatedAccountData);

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving active platform:", error);
      res.status(500).json({ error: "Failed to save active platform" });
    }
  });

  // Test API key (validates without incurring inference costs)
  app.post("/api/auth/api-keys/test", withDerivedKey, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { provider } = req.body;
      if (!provider) {
        return res.status(400).json({ error: "Provider is required" });
      }

      // Valid providers from config
      if (!config.llm.allowedTargets.has(provider)) {
        return res.status(400).json({ error: "Invalid provider" });
      }

      // Get user from database
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get current account data
      const currentAccountData = user.accountData || {};

      // Decrypt apiKeys field
      const derivedKey = req.derivedKey!;
      let apiKeys: ApiKeysMap = {};

      if (currentAccountData.apiKeys) {
        try {
          const decryptedApiKeys = decrypt(
            currentAccountData.apiKeys,
            derivedKey,
          );
          apiKeys = JSON.parse(decryptedApiKeys) as ApiKeysMap;
        } catch (error) {
          console.error("Error decrypting API keys:", error);
          return res.status(500).json({ error: "Failed to decrypt API keys" });
        }
      }

      const providerData = apiKeys[provider];
      if (!providerData?.key) {
        return res
          .status(400)
          .json({ error: "API key not configured for this provider" });
      }

      // Test the API key based on provider
      if (provider === "vertex") {
        try {
          const client = new GoogleGenAI({
            apiKey: providerData.key,
            vertexai: true,
            apiVersion: "v1",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          // Minimal inference call to test the key (very low cost - just a few tokens)
          await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: "Hi" }] }],
            config: {
              generationConfig: {
                maxOutputTokens: 5,
                temperature: 0,
              },
              thinkingConfig: {
                includeThoughts: false,
                thinkingLevel: ThinkingLevel.MINIMAL,
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          });

          res.json({ success: true, message: "API key is valid" });
        } catch (error: unknown) {
          console.error("Vertex API key test failed:", error);
          res.status(400).json({
            success: false,
            error: "API key test failed",
            message: getErrorMessage(error),
          });
        }
      } else if (provider === "openai") {
        try {
          // Test by listing models (doesn't incur inference costs)
          const response = await fetch("https://api.openai.com/v1/models", {
            headers: {
              Authorization: `Bearer ${providerData.key}`,
            },
          });

          if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as {
              error?: { message?: string };
            };
            throw new Error(errorData.error?.message || "Invalid API key");
          }

          res.json({ success: true, message: "API key is valid" });
        } catch (error: unknown) {
          console.error("OpenAI API key test failed:", error);
          res.status(400).json({
            success: false,
            error: "API key test failed",
            message: getErrorMessage(error),
          });
        }
      } else if (provider === "anthropic") {
        try {
          const client = new Anthropic({
            apiKey: providerData.key,
          });

          // Minimal message call to test the key
          await client.messages.create({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }],
          });

          res.json({ success: true, message: "API key is valid" });
        } catch (error: unknown) {
          console.error("Anthropic API key test failed:", error);
          res.status(400).json({
            success: false,
            error: "API key test failed",
            message: getErrorMessage(error),
          });
        }
      } else if (provider === "grok") {
        try {
          // Test by listing models (doesn't incur inference costs)
          const response = await fetch("https://api.x.ai/v1/models", {
            headers: {
              Authorization: `Bearer ${providerData.key}`,
            },
          });

          if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as {
              error?: { message?: string };
            };
            throw new Error(errorData.error?.message || "Invalid API key");
          }

          res.json({ success: true, message: "API key is valid" });
        } catch (error: unknown) {
          console.error("Grok API key test failed:", error);
          res.status(400).json({
            success: false,
            error: "API key test failed",
            message: getErrorMessage(error),
          });
        }
      }
    } catch (error) {
      console.error("Error testing API key:", error);
      res.status(500).json({ error: "Failed to test API key" });
    }
  });
}
