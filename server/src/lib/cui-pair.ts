/**
 * Pending pair-request registry for the CUI → browser key-transfer handshake.
 *
 * Flow:
 *   1. CUI hits POST /api/integrations/comfyui/pair (hanging request).
 *   2. Server generates a requestId, emits `cui-pair-request` over the user
 *      event bus to the browser, registers a pending promise here, and awaits.
 *   3. Browser shows a confirm prompt. On user action, browser calls a
 *      session-authenticated tRPC procedure that invokes `resolvePairRequest`.
 *   4. That resolves the awaited promise; the CUI request returns with either
 *      the derived key (confirm) or a denial reason.
 *   5. If no response within `timeoutMs`, the request resolves as "timeout".
 *
 * In-process only. Multi-instance would need the resolver to fan-out over
 * Redis pub/sub so a browser on instance A can resolve a CUI request hanging
 * on instance B. Shape of the public API stays the same.
 */

export type PairResult =
  | { ok: true; derivedKey: string }
  | { ok: false; reason: "denied" | "timeout" | "no-session" };

interface PendingRequest {
  userId: number;
  resolve: (result: PairResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const pending = new Map<string, PendingRequest>();

export function awaitPairConfirmation(
  requestId: string,
  userId: number,
  timeoutMs: number,
): Promise<PairResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve({ ok: false, reason: "timeout" });
    }, timeoutMs);
    pending.set(requestId, { userId, resolve, reject, timer });
  });
}

/**
 * Reject a pending pair request so the waiting CUI HTTP handler's try/catch
 * returns a 500. Use when the browser path failed in a way that isn't a
 * user-initiated denial (e.g. the session is live but the derived key can't
 * be unwrapped).
 */
export function rejectPairRequest(
  requestId: string,
  userId: number,
  error: Error,
): boolean {
  const req = pending.get(requestId);
  if (!req) return false;
  if (req.userId !== userId) return false;
  clearTimeout(req.timer);
  pending.delete(requestId);
  req.reject(error);
  return true;
}

/**
 * Resolve a pending pair request. Returns true if a matching request was
 * found and resolved, false otherwise (already resolved, expired, or the
 * userId doesn't match — the last acts as a safeguard against a malicious
 * session trying to answer someone else's request).
 */
export function resolvePairRequest(
  requestId: string,
  userId: number,
  result: PairResult,
): boolean {
  const req = pending.get(requestId);
  if (!req) return false;
  if (req.userId !== userId) return false;
  clearTimeout(req.timer);
  pending.delete(requestId);
  req.resolve(result);
  return true;
}

export function hasPendingRequest(requestId: string, userId: number): boolean {
  const req = pending.get(requestId);
  return !!req && req.userId === userId;
}
