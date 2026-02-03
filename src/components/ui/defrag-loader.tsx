import { useState, useEffect } from "react";
import { motion } from "motion/react";

interface DefragLoaderProps {
  size?: number;
  className?: string;
}

const COLORS = [
  // "var(--color-cyan-medium)",
  // "var(--color-magenta-medium)",
  "var(--color-cyan-light)",
  "var(--color-magenta-light)",
  // "var(--color-cyan-dark)",
  // "var(--color-magenta-dark)",
];

function getRandomColors(count: number): string[] {
  return Array.from(
    { length: count },
    () => COLORS[Math.floor(Math.random() * COLORS.length)],
  );
}

export function DefragLoader({ size = 60, className = "" }: DefragLoaderProps) {
  const gap = 3;
  const blockHeight = (size - gap * 2) / 3;
  const cycleDuration = 2;

  // Block definitions: row 0 = bottom (1 block), row 1 = middle (2 blocks), row 2 = top (3 blocks)
  const blocks = [
    { row: 0, col: 0, widthFraction: 1, delay: 0 },
    { row: 1, col: 0, widthFraction: 0.5, delay: 0.2 },
    { row: 1, col: 1, widthFraction: 0.5, delay: 0.4 },
    { row: 2, col: 0, widthFraction: 1 / 3, delay: 0.6 },
    { row: 2, col: 1, widthFraction: 1 / 3, delay: 0.8 },
    { row: 2, col: 2, widthFraction: 1 / 3, delay: 1.0 },
  ];

  const [blockColors, setBlockColors] = useState(() =>
    getRandomColors(blocks.length),
  );

  // Randomize colors each cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockColors(getRandomColors(blocks.length));
    }, cycleDuration * 1000);

    return () => clearInterval(interval);
  }, [blocks.length]);

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      {blocks.map((block, index) => {
        const blockWidth =
          size * block.widthFraction - gap * (1 - block.widthFraction);
        const x =
          block.col * (size / (block.row === 0 ? 1 : block.row === 1 ? 2 : 3));
        const y = size - blockHeight * (block.row + 1) - gap * block.row;

        return (
          <motion.div
            key={index}
            className="absolute rounded-xs"
            style={{
              width: blockWidth,
              height: blockHeight,
              left: x,
              top: y,
              backgroundColor: blockColors[index],
            }}
            initial={{ opacity: 0, scale: 0, x: 8, y: -8, rotate: 30 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1, 0],
              x: [8, 0, 0, 0],
              y: [-8, 0, 0, 0],
              rotate: [30, 0, 0, 0],
            }}
            transition={{
              duration: cycleDuration,
              delay: block.delay,
              repeat: Infinity,
              times: [0, 0.2, 0.7, 1],
              ease: "backOut",
            }}
          />
        );
      })}
    </div>
  );
}
