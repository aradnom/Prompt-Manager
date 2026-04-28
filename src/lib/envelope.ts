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
  return isEnvelopeObj(parsed);
}

/**
 * Envelope detection for already-parsed objects. The `meta` column passes
 * through `JSON.parse` in the storage adapter, so ciphertext stored there
 * arrives as `{iv, authTag, ciphertext}` rather than the stringified form.
 */
export function isEnvelopeObj(value: unknown): value is Envelope {
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
 * Synchronous passthrough for values that might be envelopes. Envelopes come
 * back as null (caller treats that as "unreadable here"); plaintext returns
 * as-is. Used on the indexing path while write-side encryption is still off —
 * once it's on, call sites should switch to the async `decryptEnvelope`.
 */
export function unwrapValue(value: MaybeEncrypted): string | null {
  if (value == null) return null;
  if (!isEnvelope(value)) return value;
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Decrypt an envelope string using the derived AES-256-GCM key. Mirrors the
 * server's `decrypt` in `server/src/lib/auth.ts`: the authTag is appended to
 * the ciphertext and the combined buffer is passed to `aes-gcm`. Returns null
 * on any error (bad key, tampered data, malformed envelope).
 */
export async function decryptEnvelope(
  envelope: string,
  keyBytes: Uint8Array,
): Promise<string | null> {
  if (!isEnvelope(envelope)) return null;
  const { iv, authTag, ciphertext } = JSON.parse(envelope) as Envelope;
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const ctBytes = base64ToBytes(ciphertext);
    const tagBytes = base64ToBytes(authTag);
    const combined = new Uint8Array(ctBytes.length + tagBytes.length);
    combined.set(ctBytes, 0);
    combined.set(tagBytes, ctBytes.length);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(iv) as BufferSource },
      cryptoKey,
      combined as BufferSource,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
