import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CTALinkProps {
  to: string;
  children: React.ReactNode;
  theme?: "cyan" | "magenta";
  className?: string;
}

export function CTALink({
  to,
  children,
  theme = "magenta",
  className,
}: CTALinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-1 text-lg font-semibold p-2.5 pl-4 transition-colors border-2 rounded-lg no-underline text-center",
        theme === "magenta"
          ? "text-magenta-medium border-magenta-medium hover:border-magenta-light hover:text-magenta-light hover:bg-magenta-light/20"
          : "text-cyan-medium border-cyan-medium hover:border-cyan-light hover:text-cyan-light hover:bg-cyan-light/20",
        className,
      )}
    >
      <span className="inline">{children}</span>
      <ChevronRight className="inline h-5 w-5 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
