import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

interface FadePresenceProps {
  show: boolean;
  children: ReactNode;
  duration?: number;
}

export function FadePresence({
  show,
  children,
  duration = 0.3,
}: FadePresenceProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
