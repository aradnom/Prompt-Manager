import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineIconBadgeProps {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function InlineIconBadge({
  icon: Icon,
  children,
  className,
}: InlineIconBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-medium/40 rounded-sm border border-cyan-medium/40 text-cyan-light text-xs",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}
