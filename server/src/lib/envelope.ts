import { encrypt, decrypt } from "@server/lib/auth";

/**
 * Server-side envelope helpers.
 *
 * Mirrors the client's `src/lib/envelope.ts`: a value is "an envelope" iff it
 * JSON-parses to an object with exactly `{iv, authTag, ciphertext}` strings.
 * Used by routers to wrap encryption around storage calls without baking
 * encryption into the storage adapter itself — adapters stay content-agnostic.
 */

export function isEnvelope(value: unknown): boolean {
  if (typeof value !== "string") return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const keys = Object.keys(parsed);
  if (keys.length !== 3) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    typeof obj.iv === "string" &&
    typeof obj.authTag === "string" &&
    typeof obj.ciphertext === "string"
  );
}

/**
 * Tolerant decrypt: envelope → plaintext; anything else → passthrough. Lets
 * read paths work for rows that pre-date encryption, alongside rows written
 * after it was turned on.
 */
export function tryDecrypt(value: string, key: Buffer): string {
  if (!isEnvelope(value)) return value;
  return decrypt(value, key);
}

export { encrypt };
