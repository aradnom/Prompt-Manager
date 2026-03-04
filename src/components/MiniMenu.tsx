import { Link } from "react-router-dom";
import { useMenu } from "@/contexts/MenuContext";
import { useSession } from "@/contexts/SessionContext";
import { AnimatedBorderButton } from "@/components/AnimatedBorderButton";
import { RasterIcon } from "@/components/RasterIcon";
import { FadePresence } from "@/components/ui/fade-presence";
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
];

export function MiniMenu() {
  const { setIsOpen } = useMenu();
  const { isAuthenticated } = useSession();

  return (
    <FadePresence show={isAuthenticated}>
      <AnimatedBorderButton onClick={() => setIsOpen(true)} position="left">
        <div className="opacity-75 group-hover:opacity-100 transition-opacity duration-300">
          <RasterIcon name="menu" size={20} opacity={0.8} />
        </div>
      </AnimatedBorderButton>
      <nav className="fixed top-14 left-5 z-50 flex flex-col gap-4">
        {navItems.map((item) =>
          item.label ? (
            <TooltipProvider key={item.path} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    className="opacity-75 transition-opacity hover:opacity-100"
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
              to={item.path}
              className="opacity-75 transition-opacity hover:opacity-100"
            >
              <RasterIcon name={item.icon} size={20} opacity={0.8} />
            </Link>
          ),
        )}
      </nav>
    </FadePresence>
  );
}
