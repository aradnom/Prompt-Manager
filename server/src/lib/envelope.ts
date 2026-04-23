import { TRPCError } from "@trpc/server";
import { encrypt, decrypt } from "@server/lib/auth";

/**
 * Pulls the derived key off context and throws a clean tRPC error if it's
 * missing. Every router that touches encrypted fields starts here, so the
 * failure mode is uniform.
 */
export function requireKey(derivedKey: Buffer | undefined): Buffer {
  if (!derivedKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Derived key unavailable for encrypted operation",
    });
  }
  return derivedKey;
}

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

/**
 * Encrypt a set of string fields in-place (returning a shallow copy). Non-
 * string values (null/undefined/missing) pass through untouched, which lets
 * callers use the same helper for optional fields without a pre-check.
 */
export function encryptStringFields<T extends Record<string, unknown>>(
  input: T,
  fields: readonly string[],
  key: Buffer,
): T {
  const out: Record<string, unknown> = { ...input };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === "string") out[f] = encrypt(v, key);
  }
  return out as T;
}

/**
 * Mirror of `encryptStringFields` on the read path. Uses the tolerant
 * `tryDecrypt` so plaintext-legacy rows pass through.
 */
export function decryptStringFields<T extends Record<string, unknown>>(
  row: T,
  fields: readonly string[],
  key: Buffer,
): T {
  const out: Record<string, unknown> = { ...row };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === "string") out[f] = tryDecrypt(v, key);
  }
  return out as T;
}

/**
 * Encrypt a row's `meta` field (if present) via the object-envelope helper.
 * `meta` is stored as JSON, so the envelope goes in as an object that the
 * adapter JSON.stringifies into the column.
 */
export function encryptMetaField<T extends { meta?: unknown }>(
  input: T,
  key: Buffer,
): T {
  if (input.meta && typeof input.meta === "object") {
    return { ...input, meta: encryptJsonValue(input.meta, key) };
  }
  return input;
}

/**
 * Mirror of `encryptMetaField` on the read path.
 */
export function decryptMetaField<T extends { meta?: unknown }>(
  row: T,
  key: Buffer,
): T {
  if (row.meta != null) {
    return { ...row, meta: tryDecryptJsonValue(row.meta, key) };
  }
  return row;
}
