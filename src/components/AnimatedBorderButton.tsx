import { motion } from "motion/react";
import { ReactNode } from "react";

interface AnimatedBorderButtonProps {
  onClick: () => void;
  position: "left" | "right";
  color?: string;
  children: ReactNode;
}

export function AnimatedBorderButton({
  onClick,
  position,
  color = "border-magenta-dark",
  children,
}: AnimatedBorderButtonProps) {
  const positionClass = position === "left" ? "left-1" : "right-1";

  return (
    <motion.button
      onClick={onClick}
      className={`fixed top-1 ${positionClass} z-50 flex items-center justify-center group cursor-pointer`}
      style={{ width: "50px", height: "50px" }}
      whileHover="hover"
      initial="initial"
    >
      {/* Animated circular border using scale instead of border-width for smooth animation */}
      <motion.div
        className={`absolute inset-0 rounded-full border-2 ${color}`}
        variants={{
          initial: { scale: 0, opacity: 0 },
          hover: { scale: 1, opacity: 1 },
        }}
        transition={{ duration: 0.3, ease: "anticipate" }}
      />

      {/* Icon content */}
      <div className="relative z-10">{children}</div>
    </motion.button>
  );
}
