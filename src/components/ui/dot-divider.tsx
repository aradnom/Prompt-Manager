import { cn } from "@/lib/utils";

interface DotDividerProps {
  className?: string;
  dotColor?: string;
}

export function DotDivider({
  className,
  dotColor = "bg-cyan-medium",
}: DotDividerProps) {
  return (
    <div className={cn("flex justify-center gap-1 py-4 relative", className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`rounded-full ${dotColor}`}
          style={{ width: 3, height: 3 }}
        />
      ))}
    </div>
  );
}
