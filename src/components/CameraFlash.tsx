import { motion } from "motion/react";

interface CameraFlashProps {
  onComplete: () => void;
}

export function CameraFlash({ onComplete }: CameraFlashProps) {
  return (
    <motion.div
      className="absolute inset-0 z-30 rounded-lg pointer-events-none bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.6, 0] }}
      transition={{ duration: 0.4, times: [0, 0.15, 1], ease: "easeOut" }}
      onAnimationComplete={onComplete}
    />
  );
}
