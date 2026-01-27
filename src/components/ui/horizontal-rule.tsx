import { useScroll } from "@/contexts/ScrollContext";

interface HorizontalRuleProps {
  className?: string;
  animated?: boolean;
  parallax?: boolean;
}

export function HorizontalRule({
  className = "",
  animated = false,
  parallax = false,
}: HorizontalRuleProps) {
  const { scrollY } = useScroll();

  // Calculate scroll percentage (0 to 1) only if parallax is enabled
  const scrollPercentage = parallax
    ? Math.min(
        scrollY / (document.documentElement.scrollHeight - window.innerHeight),
        1,
      )
    : 0;

  // Map scroll percentage to background position (0% to 100%)
  const backgroundPosition = parallax
    ? `${scrollPercentage * 100}% 50%`
    : undefined;

  return (
    <div
      className={`h-0.5 w-full bg-linear-to-r from-cyan-medium/50 to-magenta-medium/80 ${
        animated ? "animate-gradient" : ""
      } ${parallax ? "bg-size-[200%_100%]" : ""} ${className}`}
      style={parallax ? { backgroundPosition } : undefined}
    />
  );
}
