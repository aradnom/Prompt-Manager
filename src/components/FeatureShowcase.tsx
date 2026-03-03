import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureShowcaseProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FeatureShowcase({
  title,
  description,
  children,
  className,
}: FeatureShowcaseProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("border-b border-cyan-medium/30", className)}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center gap-4 py-6 px-4 text-left cursor-pointer hover:bg-cyan-dark/50 transition-colors",
          isOpen && "bg-cyan-dark/50",
        )}
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-6 w-6 text-cyan-medium shrink-0" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {description && (
            <p className="text-cyan-medium mt-1">{description}</p>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
