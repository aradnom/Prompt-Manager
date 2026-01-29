import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useClientLLM } from "@/contexts/ClientLLMContext";
import { Button } from "@/components/ui/button";

export function LMStudioCorsWarning() {
  const { lmStudioCorsError, clearLmStudioCorsError } = useClientLLM();

  return (
    <AnimatePresence>
      {lmStudioCorsError && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-xl pointer-events-none"
        >
          <div className="pointer-events-auto bg-magenta-light text-foreground px-4 py-3 rounded-md shadow-lg border border-magenta-medium/50 flex items-start gap-3">
            <div className="flex-1 text-sm">
              Could not reach LM Studio — CORS is probably disabled.{" "}
              <Link
                to="/lm-studio-cors"
                className="underline font-medium hover:text-foreground/80"
                onClick={clearLmStudioCorsError}
              >
                See how to fix this
              </Link>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-magenta-light-foreground/10"
              onClick={clearLmStudioCorsError}
            >
              ×
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
