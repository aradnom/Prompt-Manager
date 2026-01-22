import { ReactNode } from "react";
import { MainMenu } from "./MainMenu";
import { ErrorBanner } from "./ErrorBanner";
import { ParallaxCircle } from "./ParallaxCircle";
import { MenuProvider, useMenu } from "@/contexts/MenuContext";
import { ScrollProvider } from "@/contexts/ScrollContext";

interface LayoutProps {
  children: ReactNode;
}

function LayoutContent({ children }: LayoutProps) {
  const { isOpen } = useMenu();

  return (
    <div className={`min-h-screen bg-background film-grain ${
          isOpen ? "blur-sm" : ""
        }`}>
      <div className="fixed w-250 h-250 radial-gradient-magenta" />
      <ParallaxCircle
        minScale={0.2}
        size={900}
        transitionDuration={0.8}
        minLineWidth={0}
        maxLineWidth={3}
      />
      <ParallaxCircle
      size={600}
        maxLineWidth={4}
        minLineWidth={0}
      />
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
      <MainMenu />
      <div
        className={`pl-0 relative transition-all duration-200`}
      >
        {children}
      </div>
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
