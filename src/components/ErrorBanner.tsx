import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { useErrors } from "@/contexts/ErrorContext";
import { Button } from "@/components/ui/button";

export function ErrorBanner() {
  const { errors, removeError, progressMessages } = useErrors();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 min-w-96 max-w-2xl pointer-events-none">
      <AnimatePresence>
        {progressMessages.map((pm) => (
          <motion.div
            key={pm.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto bg-cyan-dark text-foreground px-4 py-3 rounded-md shadow-lg border border-cyan-medium/50"
          >
            <div className="flex items-center justify-between text-sm mb-2">
              <span>{pm.message}</span>
              <span className="text-cyan-medium ml-3 tabular-nums">
                {Math.round(pm.progress)}%
              </span>
            </div>
            <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-cyan-medium rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pm.progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        ))}
        {errors.map((error) => (
          <motion.div
            key={error.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto bg-magenta-light text-foreground px-4 py-3 rounded-md shadow-lg border border-magenta-medium/50 flex items-start gap-3"
          >
            <div className="flex-1 text-sm">
              {error.message}
              {error.link && (
                <>
                  {" "}
                  <Link
                    to={error.link.href}
                    className="underline font-medium hover:text-foreground/80"
                    onClick={() => removeError(error.id)}
                  >
                    {error.link.label}
                  </Link>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-magenta-light-foreground/10"
              onClick={() => removeError(error.id)}
            >
              ×
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
