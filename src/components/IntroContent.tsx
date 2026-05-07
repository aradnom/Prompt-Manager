import { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface IntroContentProps {
  children: ReactNode;
  /** When true, replaces the left border with a thicker magenta accent. */
  accent?: boolean;
  className?: string;
}

export function IntroContent({
  children,
  accent = false,
  className,
}: IntroContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={cn(
        "mb-4 text-foreground bg-background/75 border border-cyan-dark p-4 content-gradient",
        accent
          ? "border-l-2 border-l-magenta-medium rounded-r-lg"
          : "rounded-lg",
        className,
      )}
    >
      <div className="max-w-4xl space-y-3">{children}</div>
    </motion.div>
  );
}
