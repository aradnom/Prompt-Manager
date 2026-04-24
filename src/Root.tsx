import { useState } from "react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { MutationCache } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { trpc, trpcClient } from "./lib/trpc";
import { emitGlobalError } from "./lib/global-error";
import { toFriendlyError } from "./lib/friendly-errors";
import App from "./App.tsx";

// Detect an UNAUTHORIZED tRPC response (derived key missing, session expired,
// etc.). The server throws TRPCError({code: "UNAUTHORIZED"}) from requireKey,
// which serializes as httpStatus 401 and data.code "UNAUTHORIZED" on the wire.
function isUnauthorized(error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    const data = error.data as { code?: string; httpStatus?: number } | null;
    return data?.code === "UNAUTHORIZED" || data?.httpStatus === 401;
  }
  return false;
}

// Fire-and-forget: clear the session cookie server-side so a fresh
// `/api/auth/session` call returns unauthenticated, then hard-navigate to
// /login. Hard nav (not client-side routing) wipes in-memory React Query
// caches and re-runs all providers — simplest way to fully reset state after
// an auth failure.
let redirecting = false;
async function handleUnauthorized() {
  if (redirecting) return;
  redirecting = true;
  emitGlobalError("Session expired. Please log in again.");
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore; we're redirecting regardless.
  }
  window.location.assign("/login");
}

export default function Root() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't burn through the default 3 retries on an auth failure —
            // the outcome won't change, and the user is about to be bounced
            // to /login anyway.
            retry: (failureCount, error) => {
              if (isUnauthorized(error)) return false;
              return failureCount < 3;
            },
          },
          mutations: {
            retry: (_failureCount, error) => {
              if (isUnauthorized(error)) return false;
              return false;
            },
          },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            if (isUnauthorized(error)) {
              handleUnauthorized();
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (isUnauthorized(error)) {
              handleUnauthorized();
              return;
            }
            // Only emit global error if the mutation doesn't have its own onError handler.
            if (!mutation.options.onError) {
              emitGlobalError(toFriendlyError(error.message));
            }
          },
        }),
      }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
