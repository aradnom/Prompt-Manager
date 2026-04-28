/**
 * Browser-side HKDF-SHA256 derivation that mirrors the server's
 * `deriveEncryptionKey` in `server/src/lib/auth.ts` (which uses `@panva/hkdf`).
 *
 * Inputs, salt, info string, hash, and output length must match the server
 * byte-for-byte — anything different here yields a different key and every
 * envelope fails to decrypt.
 */

const INFO = new TextEncoder().encode("account-data-encryption");
const KEY_BYTES = 32; // AES-256

export async function deriveEncryptionKey(
  token: string,
  salt: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const ikm = encoder.encode(token);
  const saltBytes = encoder.encode(salt);

  const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);

  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes,
      info: INFO,
    },
    baseKey,
    KEY_BYTES * 8,
  );

  return new Uint8Array(bits);
}
