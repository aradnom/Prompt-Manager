# Backend Security Review

Comprehensive security review of the backend (`server/`, `deploy/`, `shared/`).
Reviewed 2026-02-18. Prior auth-specific review in `auth-security-review.md`.

---

## Critical Findings

### 1. CORS Falls Back to Fully Open in Production - FIXED

**Files:** `server/src/index.ts:37-44`

```ts
if (process.env.CORS_ORIGINS) {
  app.use(cors({ origin: origins, credentials: true }));
} else if (config.nodeEnv === "development") {
  app.use(cors({ origin: true, credentials: true }));
} else {
  app.use(cors()); // ← production default: WIDE OPEN
}
```

If `CORS_ORIGINS` is not set in production, `cors()` is called with no config, which defaults to `Access-Control-Allow-Origin: *`. This means any site on the internet can make API requests to the server. The only reason session cookies don't travel with those requests is that `credentials: true` is _not_ set in this branch -- but tRPC and the integration endpoints could still be probed or abused.

**Risk:** High. A misconfigured deployment exposes the entire API.

**Fix:** The production branch should deny cross-origin requests entirely (no CORS middleware) or throw at startup when `CORS_ORIGINS` is missing, similar to how missing secrets are handled.

---

### 2. No Rate Limiting on tRPC Routes or Integration Endpoints - FIXED

**Files:** `server/src/index.ts:109-115`, `server/src/express-routes/integrations.ts`

Rate limiting is only applied to the Express auth routes (`/api/auth/login`, `/api/auth/register`). The entire tRPC layer (`/trpc/*`) and all ComfyUI integration endpoints (`/api/integrations/*`) have no rate limiting at all.

This means:

- LLM transform endpoints can be called at arbitrary speed, burning through API credits (server-side keys or user keys)
- Bulk data enumeration of blocks/stacks/wildcards is unthrottled
- ComfyUI integration endpoints (authenticated with API key) have no throttle

**Risk:** High. An authenticated user (or compromised integration key) can run up unbounded LLM API costs.

**Fix:** Add rate limiting middleware to the tRPC handler and integration routes. The LLM transform endpoint deserves its own stricter limit since each call costs real money.

---

### 3. No Input Length Limits on LLM Text Input - FIXED

**Files:** `server/src/routers/llm.ts:35`, `server/src/services/llm-service.ts`

```ts
text: z.string(),   // ← no .max() constraint
```

The `text` field sent to LLM providers has no maximum length. A user could send megabytes of text, which would:

- Be forwarded as-is to external LLM APIs (potentially exceeding context windows and generating large bills)
- Generate very large system prompts via `buildSystemPrompt()` which interpolates `requestText.length` into the prompt text

**Risk:** Medium-High. Direct financial impact from LLM API abuse.

**Fix:** Add `z.string().max(reasonable_limit)` to the LLM input schema. Something like 50,000 characters would be generous for prompt text while preventing abuse.

---

### 4. No Input Length Limits on Several Data Fields - FIXED

**Files:** `server/src/routers/blocks.ts`, `server/src/routers/stacks.ts`, `server/src/routers/wildcards.ts`

Several fields across routers lack `.max()` constraints:

| Router                  | Field                       | Issue                         |
| ----------------------- | --------------------------- | ----------------------------- |
| blocks.create/update    | `text`                      | Unbounded string stored in DB |
| blocks.create/update    | `uuid`, `displayId`, `name` | Unbounded strings             |
| blocks.search           | `query`                     | Unbounded search term         |
| wildcards.create/update | `content`                   | Could be arbitrarily large    |
| stacks.create/update    | `uuid`, `displayId`, `name` | Unbounded strings             |
| users.setScratchpad     | `content`                   | Unbounded                     |

The database columns do have `varchar(255)` constraints in some cases, so Postgres would reject oversized data, but this means unvalidated payloads hit the DB layer rather than being rejected early. The `text` and `content` columns are unbounded `text` type.

**Risk:** Medium. Allows storage of very large payloads, potential for DB bloat or memory pressure.

**Fix:** Add `.max()` constraints to Zod schemas that match the DB column limits (or reasonable application limits for `text` columns).

---

### 5. LM Studio SSRF Vector

**Files:** `server/src/services/lm-studio-service.ts:16-17`, `server/src/config.ts:100-101`

```ts
const response = await fetch(`${this.config.lmStudioUrl}/chat/completions`, { ... });
```

The `LM_STUDIO_URL` environment variable controls where the server makes HTTP requests. If an attacker gains control of env vars (or if a future feature lets users specify this URL), the server becomes an SSRF proxy.

Currently the URL is read from env only and isn't user-controllable, so this is low risk today. But the `resolveLocalhost()` function in `config.ts` does string replacement on the URL, which is unusual.

**Risk:** Low (currently). Worth noting for future-proofing.

**Fix:** No immediate action needed, but if LM Studio URL ever becomes user-configurable, validate against a URL allowlist.

---

### 6. Integration Endpoints Accept Token in Query String

**Files:** `server/src/express-routes/integrations.ts:41-43`

```ts
if (!token && req.query.token) {
  token = req.query.token as string;
}
```

The ComfyUI integration endpoints accept the API key as a query parameter for SSE compatibility. Query parameters are logged by web servers, proxies, CDNs, and browser history. This means the API key could end up in:

- Nginx/Apache/GKE access logs
- Cloud load balancer logs
- Browser history (if accessed via browser)
- Referrer headers

**Risk:** Medium. Token leakage through infrastructure logs.

**Fix:** For the SSE endpoint where query params are necessary, consider a short-lived ticket/nonce exchange pattern instead. For non-SSE endpoints, remove query string auth and require the Authorization header only.

---

### 7. Unnecessary Packages in Production Docker Image - FIXED

**Files:** `deploy/Dockerfile:19`

```dockerfile
RUN apk add --no-cache vim git
```

`vim` and `git` in the production container increase the attack surface. If an attacker gains container access (via RCE, dependency exploit, etc.), these tools make lateral movement and exfiltration easier.

**Risk:** Low. Defense in depth.

**Fix:** Remove both. If debugging is needed, use `kubectl exec` with a debug container or `kubectl cp`.

---

### 8. No CSRF Protection on Express Auth Endpoints

**Files:** `server/src/express-routes/auth.ts`

The auth Express routes (`/api/auth/register`, `/api/auth/login`, etc.) use `sameSite: "strict"` cookies, which provides CSRF protection in modern browsers. However:

- There is no explicit CSRF token mechanism
- Older browsers that don't support `sameSite` would be vulnerable
- The `SameSite: strict` attribute on the session cookie means legitimate cross-site navigation flows would also be blocked (which is fine for an SPA)

This is mitigated by `sameSite: "strict"` being set on both cookies. The practical risk is low since this is an SPA and all auth happens via XHR.

**Risk:** Low. `SameSite: strict` provides adequate protection for this use case.

---

### 9. Error Messages May Leak Internal Details

**Files:** `server/src/express-routes/auth.ts:528-533`

```ts
res.status(400).json({
  success: false,
  error: "API key test failed",
  message: getErrorMessage(error), // ← passes error.message to client
});
```

When API key testing fails, the raw error message from the LLM provider SDK is forwarded to the client. These messages can contain internal details like SDK versions, request IDs, and endpoint URLs. This is done for all four providers (Vertex, OpenAI, Anthropic, Grok).

Similarly, `server/src/routers/llm.ts` relies on tRPC's default error handling which passes through the full error message.

**Risk:** Low. Information disclosure.

**Fix:** Sanitize or genericize error messages before returning them to the client. Keep the detailed messages in server-side logs only.

---

### 10. `types` Router Uses `publicProcedure`

**Files:** `server/src/routers/types.ts:18, 28`

```ts
get: publicProcedure; // ← no auth required
list: publicProcedure; // ← no auth required
```

The `types` router (block types like "scene", "modifier", etc.) uses `publicProcedure`, meaning anyone can list and query types without authentication. The `config` router also uses `publicProcedure`.

For `types`, this is probably intentional since types are shared/global. For `config`, it only exposes allowed LLM target names. But it's worth confirming this is deliberate rather than an oversight.

**Risk:** Low. Only read-only access to non-sensitive data.

---

## Positive Findings (Things Done Well)

### Authentication Architecture

- Token-based auth with HMAC-BLAKE2b hashing, rejection sampling for token generation (79+ bits entropy), and HKDF key derivation is solid
- Session regeneration on login/register prevents session fixation
- Dual-cookie architecture (session cookie + httpOnly sessionKey) means a compromised session store alone can't decrypt account data
- Required secrets enforced at startup (no hardcoded fallbacks)

### Authorization Model

- Every tRPC data mutation and query router (`blocks`, `stacks`, `wildcards`, `users`, `stackTemplates`, `blockFolders`, `stackFolders`) uses `protectedProcedure`
- Ownership checks on get/update/delete: the pattern `if (entity.userId !== ctx.userId) throw new Error("Unauthorized")` is consistently applied across all entity operations
- `ctx.userId` is set from the session in the tRPC context factory, so it can't be spoofed by the client

### SQL Injection Prevention

- Kysely query builder is used throughout the postgres adapter with parameterized queries
- Even the `ILIKE` search uses `%${options.query}%` as a parameter value (not string concatenation into raw SQL)
- The `sql` tagged template in Kysely parameterizes interpolated values, so `sql`\`ARRAY[${label}]::varchar[]\`` is safe
- No raw SQL string concatenation anywhere in the codebase

### Input Validation

- Zod schemas validate all tRPC inputs at the boundary
- Enum fields (`operation`, `target`, `style`, `thinkingLevel`) are properly constrained
- Pagination limits are bounded (`.max(100)`)

### Session Security

- Redis-backed sessions with `httpOnly`, `secure` (in production), `sameSite: "strict"`
- 30-day expiry
- Separate Redis instances for sessions and rate limiting

### API Key Storage

- User API keys (OpenAI, Anthropic, etc.) are encrypted with AES-256-GCM using the derived key before storage
- The derived key itself is encrypted with a per-session key stored in a separate httpOnly cookie
- API key test endpoint doesn't expose the stored key, only returns configured/unconfigured status

### Deployment

- Multi-stage Docker build excludes build artifacts and dev dependencies
- Non-root user in container
- Secrets are runtime environment variables, not baked into the image
- `set -e` in all shell scripts with proper quoting

---

## Recommendations Summary

| #   | Finding                                         | Severity    | Effort |
| --- | ----------------------------------------------- | ----------- | ------ |
| 1   | CORS open by default in production              | High        | Low    |
| 2   | No rate limiting on tRPC/integration routes     | High        | Medium |
| 3   | No max length on LLM text input                 | Medium-High | Low    |
| 4   | Missing `.max()` on various Zod schemas         | Medium      | Low    |
| 5   | LM Studio URL SSRF (future risk)                | Low         | N/A    |
| 6   | Token in query string for integrations          | Medium      | Medium |
| 7   | vim/git in production container                 | Low         | Low    |
| 8   | No explicit CSRF tokens (mitigated by SameSite) | Low         | N/A    |
| 9   | Error messages leak provider details            | Low         | Low    |
| 10  | types/config routers use publicProcedure        | Low         | Low    |

### Priority Actions

1. **Fix CORS fallback** -- throw at startup if `CORS_ORIGINS` is not set when `NODE_ENV=production`, or default to no CORS headers (deny all cross-origin)
2. **Add rate limiting to tRPC** -- especially the `llm.transform` mutation, which has direct cost implications
3. **Add `z.string().max(N)` to LLM text input** and other unbounded string fields
4. **Evaluate query-string token** for integration SSE -- consider a nonce exchange

### Nice-to-Have

- Remove `vim` and `git` from production Dockerfile
- Add a Dockerfile `HEALTHCHECK` instruction
- Sanitize LLM provider error messages before returning to client
- Add `npm audit` to CI/CD pipeline
- Consider adding request body size limits via `express.json({ limit: '1mb' })` (currently using Express default of 100kb, which is reasonable but worth making explicit)
