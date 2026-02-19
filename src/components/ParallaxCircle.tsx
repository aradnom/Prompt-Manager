import { useState, useEffect } from "react";
import { useScroll } from "@/contexts/ScrollContext";

interface ParallaxCircleProps {
  size?: number;
  sizePercentage?: number;
  minScale?: number;
  maxScale?: number;
  minLineWidth?: number;
  maxLineWidth?: number;
  transitionDuration?: number;
  backgroundColor?: string;
  scrollMultiplier?: number;
}

export function ParallaxCircle({
  size,
  sizePercentage,
  minScale = 0.3,
  maxScale = 1,
  minLineWidth = 2,
  maxLineWidth = 8,
  transitionDuration = 0.1,
  scrollMultiplier = 1,
}: ParallaxCircleProps) {
  const { scrollY, maxScrollY } = useScroll();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Double the percentage-based size since the circle is centered at the
  // top-left corner and only half the diameter is visible on each axis.
  const resolvedSize =
    size ?? (sizePercentage ? (sizePercentage / 100) * windowWidth * 2 : 800);

  // Apply scroll multiplier
  const effectiveScrollY = scrollY * scrollMultiplier;

  // Scroll progress from 0 (top) to 1 (bottom), based on actual content height
  const scrollProgress = maxScrollY > 0 ? effectiveScrollY / maxScrollY : 0;
  const clampedProgress = Math.min(1, Math.max(0, scrollProgress));

  // Calculate scale based on scroll progress
  const scaleRange = maxScale - minScale;
  const scale = maxScale - clampedProgress * scaleRange;

  // Animate line width based on scroll progress (starts at max, shrinks to min)
  const lineWidthRange = maxLineWidth - minLineWidth;
  const clampedWidth = maxLineWidth - clampedProgress * lineWidthRange;

  // Position to center at (0, 0)
  const offset = -resolvedSize / 2;

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        top: `${offset}px`,
        left: `${offset}px`,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        transition: `transform ${transitionDuration}s ease-in-out`,
        willChange: "transform",
        zIndex: 0,
      }}
    >
      <div
        className="rounded-full relative"
        style={{
          width: `${resolvedSize}px`,
          height: `${resolvedSize}px`,
          background: `linear-gradient(
            135deg,
            color-mix(in srgb, black 80%, transparent) 0%,
            color-mix(in srgb, var(--color-background) 10%, transparent) 50%,
            color-mix(in srgb, var(--color-magenta-light) 60%, transparent) 100%
          )`,
          padding: `${clampedWidth}px`,
          transition: `padding ${transitionDuration}s ease-in-out`,
          willChange: "padding",
        }}
      >
        <div
          className="rounded-full w-full h-full"
          style={{
            background: "rgb(from var(--color-background) r g b / 35%)",
          }}
        />
      </div>
    </div>
  );
}
