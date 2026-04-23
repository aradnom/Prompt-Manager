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

/**
 * Envelope detection for already-parsed objects (as opposed to envelope
 * strings). The meta column passes through a `JSON.parse` on read, so
 * ciphertext wrapped in the meta field arrives as `{iv, authTag, ciphertext}`
 * rather than the stringified form.
 */
export function isEnvelopeObj(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 3) return false;
  return (
    typeof obj.iv === "string" &&
    typeof obj.authTag === "string" &&
    typeof obj.ciphertext === "string"
  );
}

/**
 * Encrypt an arbitrary JSON-serializable value and return the envelope as an
 * object (so it can be fed into a column that expects a JSON object — e.g.
 * `meta`). Callers that want the stringified envelope can `JSON.stringify` it.
 */
export function encryptJsonValue(
  value: unknown,
  key: Buffer,
): Record<string, unknown> {
  const envelope = encrypt(JSON.stringify(value), key);
  return JSON.parse(envelope) as Record<string, unknown>;
}

/**
 * Tolerant counterpart for `encryptJsonValue`: if the input looks like an
 * envelope object, decrypt and JSON-parse the plaintext. Otherwise return as
 * is (legacy rows that pre-date encryption).
 */
export function tryDecryptJsonValue(value: unknown, key: Buffer): unknown {
  if (!isEnvelopeObj(value)) return value;
  const plaintext = decrypt(JSON.stringify(value), key);
  return JSON.parse(plaintext);
}

export { encrypt };
