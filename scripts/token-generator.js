import { randomBytes } from 'crypto';

export function generateToken() {
  // 0, 1, I, L, O excluded. U included. Specifically.
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; 
  const length = 12;
  let token = '';
  
  // Using randomBytes for cryptographic security
  const bytes = randomBytes(length);

  for (let i = 0; i < length; i++) {
    const randomIndex = bytes[i] % chars.length;
    token += chars[randomIndex];
  }

  // Output format: XXXX-XXXX-XXXX
  return token.match(/.{1,4}/g)?.join('-') || token;
}

console.log(generateToken());