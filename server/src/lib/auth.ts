import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from "crypto";
import { hkdf } from "@panva/hkdf";

/**
 * Generate a user-friendly access token
 * Format: XXXX-XXXX-XXXX-XXXX (16 characters, excludes 0, 1, I, L, O)
 */
export function generateToken(): string {
  // 0, 1, I, L, O excluded. U included. Specifically.
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const length = 16;

  // Rejection sampling to eliminate modulo bias.
  // Discard any byte >= maxValid (largest multiple of chars.length that fits in a byte).
  const maxValid = Math.floor(256 / chars.length) * chars.length; // 248 for 31 chars
  const selected: number[] = [];
  while (selected.length < length) {
    const buf = randomBytes(length - selected.length + 4);
    for (let i = 0; i < buf.length && selected.length < length; i++) {
      if (buf[i] < maxValid) selected.push(buf[i]);
    }
  }

  let token = "";
  for (const byte of selected) {
    token += chars[byte % chars.length];
  }

  // Output format: XXXX-XXXX-XXXX-XXXX
  return token.match(/.{1,4}/g)?.join("-") || token;
}

/**
 * Hash a token using HMAC-BLAKE2b for deterministic database lookup
 */
export function hashToken(token: string, secret: string): string {
  return createHmac("blake2b512", secret).update(token).digest("hex");
}

/**
 * Derive an encryption key from a token using HKDF
 * This creates a strong encryption key without storing it
 */
export async function deriveEncryptionKey(
  token: string,
  saltString: string,
): Promise<Buffer> {
  const salt = Buffer.from(saltString);
  const info = Buffer.from("account-data-encryption");

  const key = await hkdf(
    "sha256",
    Buffer.from(token),
    salt,
    info,
    32, // 256 bits for AES-256
  );

  return Buffer.from(key);
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Return: iv + authTag + ciphertext (all base64)
  return JSON.stringify({
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted,
  });
}

/**
 * Decrypt a string using AES-256-GCM
 */
export function decrypt(encryptedData: string, key: Buffer): string {
  const { iv, authTag, ciphertext } = JSON.parse(encryptedData);

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt account data object (each field encrypted separately)
 */
export async function encryptAccountData(
  data: Record<string, string>,
  token: string,
  salt: string,
): Promise<Record<string, string>> {
  const key = await deriveEncryptionKey(token, salt);
  const encrypted: Record<string, string> = {};

  for (const [field, value] of Object.entries(data)) {
    encrypted[field] = encrypt(value, key);
  }

  return encrypted;
}

/**
 * Decrypt account data object
 */
export async function decryptAccountData(
  encryptedData: Record<string, string>,
  token: string,
  salt: string,
): Promise<Record<string, string>> {
  const key = await deriveEncryptionKey(token, salt);
  const decrypted: Record<string, string> = {};

  for (const [field, encryptedValue] of Object.entries(encryptedData)) {
    decrypted[field] = decrypt(encryptedValue, key);
  }

  return decrypted;
}

/**
 * Generate a random session encryption key
 * This key will be stored in an httpOnly cookie
 */
export function generateSessionKey(): string {
  return randomBytes(32).toString("base64");
}

/**
 * Encrypt the derived key with the session key
 * The encrypted result is stored in the session
 */
export function encryptDerivedKey(
  derivedKey: Buffer,
  sessionKey: string,
): string {
  const key = Buffer.from(sessionKey, "base64");
  return encrypt(derivedKey.toString("base64"), key);
}

/**
 * Decrypt the derived key from the session using the session key
 */
export function decryptDerivedKey(
  encryptedDerivedKey: string,
  sessionKey: string,
): Buffer {
  const key = Buffer.from(sessionKey, "base64");
  const decrypted = decrypt(encryptedDerivedKey, key);
  return Buffer.from(decrypted, "base64");
}
