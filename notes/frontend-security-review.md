# Frontend Security Review

Comprehensive security review of the frontend (`src/`, `shared/`, root config files).
Reviewed 2026-02-18. Companion to `backend-security-review.md`.

---

## Critical Findings

### 1. Client-Side SSRF via LM Studio URL

**Files:** `src/contexts/ClientLLMContext.tsx`, `src/lib/storage.ts`

```ts
const response = await fetch(`${lmStudioUrl}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages, temperature: 0.7, max_tokens: 2048 }),
});
```

The LM Studio URL is user-configurable, stored in IndexedDB, and used directly in a `fetch()` call from the browser. A user can set this to any URL (e.g., an internal corporate endpoint, a cloud metadata service at `http://169.254.169.254/`, etc.), effectively making their own browser a request proxy.

Since this runs in the user's browser (not the server), the attacker and victim are the same person -- so the practical risk is limited. However, if the URL field were ever pre-populated from server-side data or shared between users, this would become a real SSRF vector.

**Risk:** Low (self-inflicted only). Worth noting for future-proofing.

**Fix:** Validate the URL against a pattern (e.g., must be `localhost`, `127.0.0.1`, or a private IP range). Show a warning if the user enters a non-local URL.

---

### 2. No Content Security Policy

**Files:** `index.html`, server response headers (not configured)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Prompt Manager</title>
  </head>
</html>
```

There is no Content-Security-Policy header or meta tag. If an XSS vulnerability were introduced (e.g., via a future feature or dependency), there would be no CSP to limit the damage. CSP is defense-in-depth -- it doesn't prevent XSS on its own, but it significantly limits what an attacker can do if they achieve injection.

The application currently has zero `dangerouslySetInnerHTML` usage and relies entirely on React's auto-escaping, which is excellent. CSP would be an additional safety net.

**Risk:** Medium (defense-in-depth gap).

**Fix:** Add a strict CSP header on the server (or via a meta tag for the SPA):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* http://127.0.0.1:*; worker-src 'self' blob:;
```

The `connect-src` allowlist for localhost is needed for LM Studio. The `worker-src blob:` is needed for Transformers.js (WASM/WebGPU workers). `unsafe-inline` for styles is required by many CSS-in-JS and UI libraries (including Radix).

---

### 3. No Client-Side Route Guards

**Files:** `src/App.tsx`, all page components in `src/pages/`

```tsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/prompts" element={<Stacks />} />
  <Route path="/blocks" element={<Blocks />} />
  <Route path="/wildcards" element={<Wildcards />} />
  <Route path="/account" element={<Account />} />
  {/* ... all routes accessible to everyone */}
</Routes>
```

All routes are rendered inside `<Layout>` with no authentication guard at the router level. Individual pages like `Home.tsx` conditionally render a login form vs. the main UI based on `isAuthenticated` from `SessionContext`, but pages like `Blocks`, `Stacks`, `Wildcards`, `Snapshots`, and `Templates` have no auth check at all -- they simply call tRPC queries that will fail or return empty data for unauthenticated users.

The only page with an explicit guard is `DeveloperSettings.tsx`, which redirects non-admin users via `useEffect`.

This is not a vulnerability because the backend enforces authentication on all `protectedProcedure` tRPC endpoints. But it results in a poor UX (blank pages, error states) for unauthenticated users who navigate directly to `/blocks`, etc.

**Risk:** Low (UX issue, not a security hole). Backend enforcement is the real gate.

**Fix:** Add a route guard component that wraps authenticated routes and redirects to `/` (or a login page) when `!isAuthenticated`. This is a UX improvement, not a security fix.

---

### 4. API Error Messages Displayed to Users

**Files:** `src/contexts/ErrorContext.tsx`, `src/pages/Account.tsx`, various components

```ts
// Account.tsx - API key test response
if (data.success === false) {
  setError(data.message || data.error || "API key test failed");
}

// Various components via ErrorContext
addError(error instanceof Error ? error.message : "Failed to create block");
```

Backend error messages (including LLM provider SDK errors) are displayed directly to users via the error toast system. These messages can contain:

- Internal endpoint URLs
- SDK version strings
- Request IDs
- Rate limit details

The `ErrorContext` auto-dismisses after 8 seconds, but the information is still briefly visible. Combined with the backend finding (#9 in backend review) about error message leakage, this creates an end-to-end information disclosure path from LLM provider to user's screen.

**Risk:** Low. Information disclosure to the authenticated user who triggered the error.

**Fix:** Sanitize or genericize error messages before displaying. Keep detailed errors in `console.error()` only (or send to an error tracking service).

---

### 5. Monorepo Package Structure Mixes Frontend and Backend Dependencies

**Files:** `package.json`

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.71.2",
    "express": "^5.2.1",
    "pg": "^8.16.3",
    "react": "^18.3.1",
    "openai": "^6.16.0",
    "kysely": "^0.28.9",
    ...
  }
}
```

The project uses a single `package.json` for both the Vite frontend and the Express backend. This means:

- `npm install` for the frontend also installs `pg`, `express`, `kysely`, `@anthropic-ai/sdk`, `openai`, etc.
- The Vite bundler's tree-shaking prevents backend code from ending up in the frontend bundle, but the packages are still downloaded and present in `node_modules`
- A supply chain attack on any backend dependency would also compromise the frontend build environment
- `npm audit` results are noisy because backend-only vulnerabilities (e.g., in `pg`) show up when running the frontend

This isn't a direct vulnerability, but it increases the attack surface of the development and build environment.

**Risk:** Low. Architectural concern.

**Fix:** Consider splitting into workspaces (`npm workspaces` or similar) so frontend and backend have separate dependency trees. This also makes the Docker build more efficient (only backend deps in the container).

---

### 6. Math.random() Fallback for UUID Generation

**Files:** `src/lib/uuid.ts`

```ts
export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback polyfill
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

The UUID generator falls back to `Math.random()` when `crypto.randomUUID()` is unavailable. `Math.random()` is not cryptographically secure -- its output can be predicted if enough samples are observed.

In practice, `crypto.randomUUID()` is available in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+), so this fallback would only trigger in very old browsers. The UUIDs are used as client-generated identifiers for blocks and stacks (sent to the server as `uuid` and `displayId`), not as security tokens.

**Risk:** Low. Predictable UUIDs could allow an attacker to guess another user's block/stack UUIDs, but the backend checks ownership (`userId`) on all operations, so knowing a UUID doesn't grant access.

**Fix:** No action needed. If desired, replace the fallback with `crypto.getRandomValues()` which has broader browser support than `randomUUID()`.

---

### 7. Console Error Logging in Production

**Files:** Throughout `src/contexts/`, `src/pages/`, `src/components/`

```ts
// SessionContext.tsx
console.error("Error checking session:", err);

// Account.tsx
console.error("Error logging in:", error);
console.error("Error saving API key:", err);

// ClientLLMContext.tsx
console.error("Failed to initialize Transformers.js:", err);
```

Multiple `console.error()` calls throughout the application log error details to the browser console in production. While these don't contain API keys or tokens, they do expose:

- Error stack traces
- Network error details
- LLM provider error messages
- Internal application state information

Anyone with browser DevTools open (or browser extensions that capture console output) can see these.

**Risk:** Low. Information disclosure via browser console.

**Fix:** Consider a lightweight error reporting approach that strips details in production, or use `import.meta.env.DEV` guards around verbose console logging.

---

## Positive Findings (Things Done Well)

### XSS Prevention

- **Zero** `dangerouslySetInnerHTML` usage across the entire `src/` directory
- **Zero** `innerHTML`, `eval()`, `new Function()`, or `document.write()` calls
- All user-generated content (block text, wildcard content, stack names, search queries) is rendered through React's JSX auto-escaping
- Wildcard and modifier parsing (`wildcard-parser.ts`, `modifier-parser.ts`) outputs plain text segments rendered as React text nodes, not HTML

### Authentication Architecture

- Session state managed via `SessionContext` which calls `/api/auth/session` on mount
- Only stores `isAuthenticated`, `userId`, `isAdmin` flags -- never stores tokens or cookies in JavaScript
- All API calls use `credentials: "include"` to send httpOnly session cookies
- tRPC client configured with `credentials: "include"` globally via `httpBatchLink`
- Logout clears all client-side state (session context, active stack, IndexedDB)

### No Sensitive Data in Client Storage

- **localStorage**: Only UI preferences (`thinking-enabled`, `thinking-level`, `stackOutputMinimized`)
- **IndexedDB**: Only `active-stack-id` (numeric) and `lm-studio-url` (localhost endpoint)
- **sessionStorage**: Not used at all
- **React state/context**: No tokens, API keys, or credentials stored
- API keys entered on the Account page are held in component-local state, sent to the server via POST, and the input is cleared after save. The server never returns stored API keys back to the client.

### URL Safety

- All fetch calls use relative URLs (`/trpc`, `/api/auth/*`) -- no absolute URL construction from user input
- React Router routes are defined with string literals
- URL parameters (`displayId`, `id`) are used only for data lookup via tRPC, not interpolated into fetch URLs
- No `window.open()`, `window.postMessage()`, or `target="_blank"` links found
- The only dynamic `src={}` attribute is in `RasterIcon.tsx` which resolves webpack-imported icon modules

### Input Validation

- Display IDs sanitized by `normalizeDisplayId()`: `value.toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "")` -- only letters, numbers, and hyphens
- Wildcard display IDs restricted by regex: `[a-zA-Z0-9\-_]+`
- Wildcard content validated: 10MB size limit, null byte rejection, control character blocking
- `maxLength={255}` on inline rename inputs
- Notes capped at 4000 characters
- Generate concept input sliced to 140 characters

### Client-Side LLM Isolation

- Transformers.js runs entirely in-browser (WASM/WebGPU) with no external API calls during inference
- Model is a public HuggingFace model (`onnx-community/Llama-3.2-1B-Instruct-ONNX`)
- LM Studio connects only to a user-specified local endpoint, no auth tokens transmitted
- Client-side LLM code is completely separate from server-side LLM routing

### Safe DOM Interaction

- No direct DOM manipulation for content rendering
- Event listeners (`mousedown`, `keydown`) are properly cleaned up in `useEffect` return functions
- Clipboard API used safely with feature detection and error handling
- `dnd-kit` library used for drag-and-drop (no native HTML5 drag events or `dataTransfer` manipulation)

### Build Configuration

- Vite dev server proxy forwards `/trpc` and `/api` to backend -- no CORS issues in development
- TypeScript strict mode with `tsc -b` in build step
- ESLint with `react-hooks` and `react-refresh` plugins
- Husky + lint-staged for pre-commit formatting
- `"type": "module"` for ES module consistency

---

## Recommendations Summary

| #   | Finding                                        | Severity | Effort |
| --- | ---------------------------------------------- | -------- | ------ |
| 1   | LM Studio URL not validated (client-side SSRF) | Low      | Low    |
| 2   | No Content Security Policy                     | Medium   | Medium |
| 3   | No client-side route guards                    | Low      | Low    |
| 4   | API error messages shown to users              | Low      | Low    |
| 5   | Monorepo mixes frontend/backend deps           | Low      | High   |
| 6   | Math.random() UUID fallback                    | Low      | Low    |
| 7   | Console error logging in production            | Low      | Low    |

### Priority Actions

1. **Add a Content Security Policy** -- either as a server response header or an `index.html` meta tag. This is the single most impactful defense-in-depth measure for the frontend.
2. **Sanitize error messages** before displaying in the UI. Show generic messages to users, log details to console or error tracker.
3. **Add `npm audit` to CI** -- the project has no automated dependency vulnerability scanning.

### Nice-to-Have

- Add a `<ProtectedRoute>` wrapper component for authenticated routes (UX improvement)
- Validate LM Studio URL against localhost/private IP ranges
- Replace `Math.random()` UUID fallback with `crypto.getRandomValues()`
- Guard verbose `console.error()` calls behind `import.meta.env.DEV`
- Consider splitting into npm workspaces to separate frontend and backend dependency trees
- Pin the Transformers.js model version/hash to prevent supply chain attacks on the HuggingFace model
