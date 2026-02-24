import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MutationCache } from "@tanstack/react-query";
import { trpc, trpcClient } from "./lib/trpc";
import { emitGlobalError } from "./lib/global-error";
import App from "./App.tsx";

export default function Root() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Only emit global error if the mutation doesn't have its own onError handler.
            if (!mutation.options.onError) {
              emitGlobalError(error.message || "An unexpected error occurred.");
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
