import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MainMenu } from "./MainMenu";
import { ErrorBanner } from "./ErrorBanner";
import { LMStudioCorsWarning } from "./LMStudioCorsWarning";
import { ParallaxCircle } from "./ParallaxCircle";
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
      <ParallaxCircle
        minScale={0.2}
        size={900}
        transitionDuration={0.8}
        minLineWidth={0}
        maxLineWidth={3}
      />
      <ParallaxCircle size={600} maxLineWidth={4} minLineWidth={0} />
      <ParallaxCircle
        minScale={0.2}
        size={400}
        transitionDuration={0.5}
        minLineWidth={0}
        maxLineWidth={3}
        scrollMultiplier={1.4}
      />
      <ParallaxCircle
        minScale={0.2}
        size={300}
        transitionDuration={0.4}
        minLineWidth={0}
        maxLineWidth={3}
      />
      <div className="film-grain fixed top-0 left-0 w-full h-full opacity-30" />
      <MainMenu />
      <Scratchpad />
      {location.pathname !== "/account" && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="fixed top-4 right-4 z-50 w-[50px] h-[50px]">
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
