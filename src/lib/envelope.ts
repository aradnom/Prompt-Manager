/**
 * Encryption envelope helpers.
 *
 * The server wraps encrypted fields as `JSON.stringify({iv, authTag, ciphertext})`
 * where each is a base64 string. A value is "an envelope" iff it parses to an
 * object with exactly those three string keys. Anything else (real plaintext,
 * a JSON object that happens to share a name, etc.) is treated as plaintext.
 *
 * Today none of the sync endpoints return ciphertext — we're building this
 * ahead of turning on content encryption so the worker/search pipeline can
 * already distinguish the two. When we flip on encryption per-field, the
 * same call site that currently receives plaintext will start receiving
 * envelopes and `unwrapValue` will handle it.
 */

export interface Envelope {
  iv: string;
  authTag: string;
  ciphertext: string;
}

/**
 * A value that might be plaintext or might be an encryption envelope. Most
 * fields are strings (names, notes, rendered_content, labels). For non-string
 * fields (meta objects, etc.) encryption will apply to a JSON-stringified
 * version before wrapping, so at the transport layer it's still a string.
 */
export type MaybeEncrypted = string | null | undefined;

export function isEnvelope(value: unknown): value is Envelope {
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
 * Unwrap a possibly-encrypted value. With no derivedKey, envelopes return
 * null (the caller should treat that as "unreadable in this context").
 * Plaintext always passes through unchanged.
 *
 * Decryption itself is deferred — we'll wire AES-256-GCM via WebCrypto here
 * when the content-encryption work lands. For now this is enough scaffolding
 * for the worker to build its search index without caring which flavor it
 * receives.
 */
export function unwrapValue(
  value: MaybeEncrypted,
  _derivedKey?: CryptoKey | null,
): string | null {
  if (value == null) return null;
  if (!isEnvelope(value)) return value;
  // TODO: decrypt once content encryption lands. Needs the derivedKey in
  // WebCrypto form and an AES-GCM decrypt call.
  return null;
}
