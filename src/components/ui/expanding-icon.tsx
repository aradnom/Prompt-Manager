import { motion } from "motion/react";
import { ReactNode, useState, useEffect } from "react";
import {
  TEXT_BLOCK_ANIMATION,
  TEXT_BLOCK_FADE,
} from "@/lib/text-block-animation-settings";

interface ExpandingIconProps {
  active: boolean;
  children: ReactNode;
  origin?: "left" | "right";
}

export function ExpandingIcon({ active, children }: ExpandingIconProps) {
  const [shouldDisplay, setShouldDisplay] = useState(active);

  useEffect(() => {
    if (active) {
      setShouldDisplay(true);
    }
  }, [active]);

  const handleAnimationComplete = () => {
    if (!active) {
      setShouldDisplay(false);
    }
  };

  return (
    <div style={{ lineHeight: 0 }}>
      <motion.div
        initial={false}
        animate={{
          width: active ? 24 : 0,
          height: active ? 24 : 0,
        }}
        transition={TEXT_BLOCK_ANIMATION}
        onAnimationComplete={handleAnimationComplete}
        style={{
          overflow: "hidden",
          display: shouldDisplay ? "inline-block" : "none",
        }}
      >
        <motion.div
          animate={{
            opacity: active ? 1 : 0,
          }}
          transition={TEXT_BLOCK_FADE}
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
