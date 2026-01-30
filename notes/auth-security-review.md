# Auth Security Review

Review of `server/src/express-routes/auth.ts`, `server/src/lib/auth.ts`, and related session/config code.

## Concern 1 — Token entropy ✅ RESOLVED

`generateToken()` originally produced 12 characters from a 31-character alphabet (~59.5 bits of entropy), which was in the marginal zone for offline brute-force given the fast HMAC-BLAKE2b hash used for lookup.

**Resolution:** Token length increased from 12 to 16 characters, yielding `log2(31^16)` ≈ **79.3 bits of entropy**. This puts offline brute-force well out of reach even with fast hashing.

## Concern 2 — Modulo bias in token generation

`auth.ts:23` — `bytes[i] % 31` introduces modulo bias since 256 isn't divisible by 31. Characters at indices 0–7 have probability 9/256 while indices 8–30 have probability 8/256. This effectively reduces the entropy slightly below the theoretical 79.3 bits.

In practice the bias is small (~0.4% per character), but it's a well-known cryptographic anti-pattern. The standard fix is rejection sampling: discard any byte >= 232 (the largest multiple of 29 <= 256) and draw again.

## Concern 3 — No session regeneration on login

In `auth.ts:146-147`, after login, the session ID (`connect.sid`) stays the same — `req.session.userId` and `req.session.encryptedDerivedKey` are just set on the existing session object. This opens a classic **session fixation** vector: if an attacker can plant a session ID cookie in the victim's browser before they log in (e.g., via a subdomain or an HTTP->HTTPS downgrade), the attacker's known session ID becomes authenticated after the victim logs in.

The fix is calling `req.session.regenerate()` before setting session data in both the `/register` and `/login` handlers. This issues a new session ID and invalidates the old one.

## Concern 4 — No `sameSite` on `connect.sid` cookie

The `sessionKey` cookie is set with `sameSite: "strict"` (`auth.ts:86`), but the express-session `connect.sid` cookie (`index.ts:62-66`) has no `sameSite` attribute. Browsers default to `Lax`, which is reasonable but inconsistent with the stricter policy on `sessionKey`. Since both cookies are needed for authenticated requests (session + derived key), the effective protection is the stricter of the two — but it's cleaner to be explicit. Adding `sameSite: "strict"` (or at least `"lax"`) to the session config would close the gap.

## Concern 5 — Hardcoded fallback secrets

`config.ts:63-69` — `sessionSecret`, `encryptionSalt`, and `tokenSecret` all have hardcoded fallback strings like `"change-this-to-a-random-secret-in-production"`. If someone deploys without setting env vars, the app runs silently with known secrets. Consider either:

- Throwing at startup if these aren't set and `NODE_ENV !== "development"`
- Or at minimum logging a loud warning

## Concern 6 — No rate limiting on auth endpoints

`/api/auth/login` and `/api/auth/register` have no rate limiting. Online brute-force against the full 79-bit token space is impractical, but rate limiting is still defense-in-depth against credential stuffing if tokens are partially leaked, and prevents abuse of the register endpoint (mass account creation).

## Lower-priority observations

- **`__PRESERVE__` sentinel** (`auth.ts:326`): If a user's actual API key happened to be the literal string `__PRESERVE__`, it would silently preserve the old key. Extremely unlikely but a code smell. A dedicated boolean flag in the request body would be more explicit.

- **Error response differentiation** in `/login`: "Invalid token" (401) vs. "Account data not found" (500) tells an attacker whether a token hash exists in the DB. With the token being hashed this is low-risk, but a uniform error response for both cases would be tighter.

- **The `withDerivedKey` middleware** design is solid — requiring both the session _and_ the httpOnly `sessionKey` cookie to reconstruct the derived key means a compromised session store alone isn't enough to decrypt account data. Good architectural decision.

## Priority

Concern 1 (token entropy) has been resolved by increasing token length to 16 characters (~79 bits). Concern 3 (session regeneration) is the most impactful remaining issue — a well-known vulnerability class with a one-line fix. The rest are hardening measures worth doing but less urgent.
