import {
  randomFillSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

const SECRET = "g8b6f6jn76fg6gtbnrfpooic54ffrty0";
const SECRET_HEADER = "PROMPT";

function generateKey() {
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

function validateKey(key) {
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
  } catch (err) {
    console.error(err);

    return false;
  }
}

const testKey = generateKey();

console.info(testKey);
console.info(validateKey(testKey));
