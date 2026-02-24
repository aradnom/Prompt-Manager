/**
 * Simple event-based bridge for surfacing errors from outside React
 * (e.g. from QueryClient's MutationCache) into the ErrorContext.
 */

type ErrorHandler = (message: string) => void;

let handler: ErrorHandler | null = null;

export function setGlobalErrorHandler(fn: ErrorHandler) {
  handler = fn;
}

export function clearGlobalErrorHandler() {
  handler = null;
}

export function emitGlobalError(message: string) {
  if (handler) {
    handler(message);
  }
}
