import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MainMenu } from "./MainMenu";
import { ErrorBanner } from "./ErrorBanner";
import { LMStudioCorsWarning } from "./LMStudioCorsWarning";
import { Scratchpad } from "./Scratchpad";
import { MenuProvider, useMenu } from "@/contexts/MenuContext";
import { ScrollProvider } from "@/contexts/ScrollContext";
import { useClientLLM } from "@/contexts/ClientLLMContext";
import { useErrors } from "@/contexts/ErrorContext";
import { AnimatedBorderButton } from "./AnimatedBorderButton";
import { RasterIcon } from "./RasterIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// import { ParallaxCircleMenuAligned } from "./ParallaxCircleMenuAligned";
import { ParallaxCircleMenuRandom } from "./ParallaxCircleMenuRandom";

const TRANSFORMERS_PROGRESS_ID = "transformers-js-load";

function TransformersLoadProgress() {
  const { loadProgress } = useClientLLM();
  const { setProgress, removeProgress } = useErrors();

  useEffect(() => {
    if (loadProgress != null) {
      setProgress(
        TRANSFORMERS_PROGRESS_ID,
        "Loading Transformers.js model\u2026",
        loadProgress,
      );
    } else {
      removeProgress(TRANSFORMERS_PROGRESS_ID);
    }
  }, [loadProgress, setProgress, removeProgress]);

  return null;
}

interface LayoutProps {
  children: ReactNode;
}

function LayoutContent({ children }: LayoutProps) {
  const { isOpen } = useMenu();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      className={`min-h-screen bg-background transition-[filter] ${
        isOpen ? "blur-sm" : ""
      }`}
    >
      <div className="fixed w-250 h-250 radial-gradient-magenta" />
      <ParallaxCircleMenuRandom />
      <div className="film-grain fixed top-0 left-0 w-full h-full opacity-30" />
      <MainMenu />
      <Scratchpad />
      {location.pathname !== "/account" && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="fixed top-4 right-4 z-50 w-12.5 h-12.5">
                <AnimatedBorderButton
                  onClick={() => navigate("/account")}
                  position="right"
                  color="border-cyan-medium"
                >
                  <div className="opacity-75 group-hover:opacity-100 transition-opacity duration-300">
                    <RasterIcon name="user-cyan" size={20} opacity={0.8} />
                  </div>
                </AnimatedBorderButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">Account</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <div className={`pl-0 relative transition-all duration-200`}>
        {children}
      </div>
      <TransformersLoadProgress />
      <LMStudioCorsWarning />
      <ErrorBanner />
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <MenuProvider>
      <ScrollProvider>
        <LayoutContent>{children}</LayoutContent>
      </ScrollProvider>
    </MenuProvider>
  );
}
