import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useMenu } from "@/contexts/MenuContext";
import { useSession } from "@/contexts/SessionContext";
import { AnimatedBorderButton } from "@/components/AnimatedBorderButton";
import { RasterIcon } from "@/components/RasterIcon";
import { FadePresence } from "@/components/ui/fade-presence";
import { DotDivider } from "./ui/dot-divider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { path: "/", icon: "home", label: null },
  { path: "/prompts", icon: "chat", label: "Prompts" },
  { path: "/blocks", icon: "blocks", label: "Blocks" },
  { path: "/wildcards", icon: "dice", label: "Wildcards" },
  { path: "/snapshots", icon: "camera", label: "Prompt Snapshots" },
  { path: "/templates", icon: "templates", label: "Prompt Templates" },
];

export function MiniMenu() {
  const { setIsOpen } = useMenu();
  const { isAuthenticated } = useSession();
  const location = useLocation();
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const activeIndex = navItems.findIndex((item) =>
      item.path === "/"
        ? location.pathname === "/"
        : location.pathname === item.path ||
          location.pathname.startsWith(item.path + "/"),
    );
    setActiveIndex(activeIndex);
    const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    if (el) {
      setIndicatorTop(el.offsetTop + el.offsetHeight / 2 - 10);
    } else {
      setIndicatorTop(null);
    }
  }, [location.pathname, isAuthenticated]);

  return (
    <FadePresence show={isAuthenticated}>
      <AnimatedBorderButton onClick={() => setIsOpen(true)} position="left">
        <div className="opacity-75 group-hover:opacity-100 transition-opacity duration-300">
          <RasterIcon name="menu" size={20} opacity={0.8} />
        </div>
      </AnimatedBorderButton>
      <nav className="fixed top-14 left-5 z-50 flex flex-col gap-4">
        <DotDivider
          dotNum={1}
          dotSize={4}
          dotColor="bg-magenta-medium/50"
          className="py-2"
        />
        {indicatorTop !== null && (
          <motion.div
            className="absolute -left-2.5 w-0.5 h-5 bg-magenta-medium/60"
            initial={false}
            animate={{ top: indicatorTop }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
        )}
        {navItems.map((item, i) =>
          item.label ? (
            <TooltipProvider key={item.path} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    to={item.path}
                    className={cn(
                      "opacity-75 transition-opacity hover:opacity-100",
                      activeIndex === i && "opacity-100",
                    )}
                  >
                    <RasterIcon name={item.icon} size={20} opacity={0.8} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Link
              key={item.path}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              to={item.path}
              className={cn(
                "opacity-75 transition-opacity hover:opacity-100",
                activeIndex === i && "opacity-100",
              )}
            >
              <RasterIcon name={item.icon} size={20} opacity={0.8} />
            </Link>
          ),
        )}
      </nav>
    </FadePresence>
  );
}
