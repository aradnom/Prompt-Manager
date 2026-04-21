import { cn } from "@/lib/utils";

interface DotDividerProps {
  className?: string;
  dotNum?: number;
  dotSize?: number;
  dotColor?: string;
}

export function DotDivider({
  className,
  dotNum = 5,
  dotSize = 3,
  dotColor = "bg-cyan-medium",
}: DotDividerProps) {
  return (
    <div className={cn("flex justify-center gap-1 py-4 relative", className)}>
      {Array.from({ length: dotNum }, (_, i) => (
        <div
          key={i}
          className={`rounded-full ${dotColor}`}
          style={{ width: dotSize, height: dotSize }}
        />
      ))}
    </div>
  );
}
