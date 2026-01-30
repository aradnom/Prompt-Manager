import { randomBytes } from "crypto";

export function generateToken() {
  // 0, 1, I, L, O excluded. U included. Specifically.
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const length = 16;

  // Rejection sampling to eliminate modulo bias.
  // Discard any byte >= maxValid (largest multiple of chars.length that fits in a byte).
  const maxValid = Math.floor(256 / chars.length) * chars.length; // 248 for 31 chars
  const selected = [];
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

console.info(generateToken());
