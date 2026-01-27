import type { Request, Response, NextFunction } from "express";
import { decryptDerivedKey } from "@server/lib/auth";

// Extend Request type to include derivedKey
declare global {
  namespace Express {
    interface Request {
      derivedKey?: Buffer;
    }
  }
}

/**
 * Middleware to decrypt and attach the derived encryption key to the request
 * Requires both an active session and the sessionKey cookie
 */
export function withDerivedKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check if encrypted derived key exists in session
    if (!req.session.encryptedDerivedKey) {
      return res
        .status(401)
        .json({ error: "Session key not found. Please log in again." });
    }

    // Get session key from cookie
    const sessionKey = req.cookies.sessionKey;
    if (!sessionKey) {
      return res
        .status(401)
        .json({ error: "Session key cookie missing. Please log in again." });
    }

    // Decrypt the derived key
    const derivedKey = decryptDerivedKey(
      req.session.encryptedDerivedKey,
      sessionKey,
    );

    // Attach to request for use in route handlers
    req.derivedKey = derivedKey;

    next();
  } catch (error) {
    console.error("Error in withDerivedKey middleware:", error);
    res.status(500).json({ error: "Failed to decrypt session key" });
  }
}
