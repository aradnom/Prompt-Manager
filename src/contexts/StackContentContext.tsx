import { createContext, useContext, useState, ReactNode } from "react";

interface StackContentContextType {
  renderedContent: string;
  setRenderedContent: (content: string) => void;
  renderedContentWithMarkers: string;
  setRenderedContentWithMarkers: (content: string) => void;
}

const StackContentContext = createContext<StackContentContextType | undefined>(
  undefined,
);

export function StackContentProvider({ children }: { children: ReactNode }) {
  const [renderedContent, setRenderedContent] = useState("");
  const [renderedContentWithMarkers, setRenderedContentWithMarkers] =
    useState("");

  return (
    <StackContentContext.Provider
      value={{
        renderedContent,
        setRenderedContent,
        renderedContentWithMarkers,
        setRenderedContentWithMarkers,
      }}
    >
      {children}
    </StackContentContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStackContent() {
  const context = useContext(StackContentContext);
  if (context === undefined) {
    throw new Error(
      "useStackContent must be used within a StackContentProvider",
    );
  }
  return context;
}
