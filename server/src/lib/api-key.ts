import {
  randomFillSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

const SECRET = process.env.API_KEY_SECRET as string;
const SECRET_HEADER = process.env.API_KEY_HEADER as string;

if (!SECRET) {
  throw new Error("API_KEY_SECRET environment variable is required");
}

if (!SECRET_HEADER) {
  throw new Error("API_KEY_HEADER environment variable is required");
}

if (SECRET.length !== 32) {
  throw new Error("API_KEY_SECRET must be exactly 32 characters for AES-256");
}

export function generateKey(): string {
  const payload = Buffer.alloc(24);
  payload.write(SECRET_HEADER, 0);
  payload.writeBigUInt64BE(BigInt(Date.now()), SECRET_HEADER.length);
  randomFillSync(payload, 8 + SECRET_HEADER.length, 10);

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", SECRET, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

export function validateKey(key: string): boolean {
  try {
    const buf = Buffer.from(key, "base64");
    const iv = buf.slice(0, 12);
    const encrypted = buf.slice(12, 36);
    const tag = buf.slice(36);

    const decipher = createDecipheriv("aes-256-gcm", SECRET, iv);
    decipher.setAuthTag(tag);

    const payload = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return payload.toString("ascii", 0, SECRET_HEADER.length) === SECRET_HEADER;
  } catch {
    return false;
  }
}
