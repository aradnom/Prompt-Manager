import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "dismissed:";

interface DismissableContainerProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  onVisibilityChange?: (visible: boolean) => void;
}

export function DismissableContainer({
  id,
  children,
  className,
  onVisibilityChange,
}: DismissableContainerProps) {
  const storageKey = STORAGE_PREFIX + id;
  const [isDismissed, setIsDismissed] = useState(
    () => localStorage.getItem(storageKey) === "1",
  );

  useEffect(() => {
    onVisibilityChange?.(!isDismissed);
  }, [isDismissed, onVisibilityChange]);

  const dismiss = useCallback(() => {
    localStorage.setItem(storageKey, "1");
    setIsDismissed(true);
  }, [storageKey]);

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn("relative standard-content", className)}
        >
          <Button
            variant="outline"
            size="xs"
            onClick={dismiss}
            title="Dismiss"
            className="absolute -right-2 -top-3 z-10"
          >
            <X className="h-4! w-4!" />
          </Button>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
