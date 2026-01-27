import { motion, AnimatePresence } from "motion/react";

interface MainMenuBorderProps {
  isOpen: boolean;
}

export function MainMenuBorder({ isOpen }: MainMenuBorderProps) {
  const opacities = [1, 0.8, 0.6, 0.4, 0.2];

  return (
    <div className="absolute top-0 right-0 h-full w-6.25 pointer-events-none">
      <AnimatePresence>
        {isOpen &&
          opacities.map((opacity, index) => (
            <motion.div
              key={index}
              className="absolute top-0 h-full w-px"
              style={{
                backgroundColor: `rgb(from var(--color-cyan-medium) r g b / ${opacity})`,
                right: 0,
              }}
              initial={{ x: 0 }}
              animate={{ x: index * 4 }}
              exit={{ x: 0 }}
              transition={{
                duration: 0.9,
                delay: index * 0.05,
                ease: "backOut",
              }}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}
