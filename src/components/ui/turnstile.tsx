import { useEffect, useRef, useCallback } from "react";

declare const __TURNSTILE_SITE_KEY__: string;

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptLoading) return scriptLoading;
  if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) {
    scriptLoading = Promise.resolve();
    return scriptLoading;
  }

  scriptLoading = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT_URL;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(el);
  });

  return scriptLoading;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export function Turnstile({ onVerify, onExpire, onError }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Stable refs for callbacks so we don't re-render the widget
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  const siteKey = __TURNSTILE_SITE_KEY__;

  const renderWidget = useCallback(async () => {
    if (!containerRef.current || !siteKey) return;

    await loadScript();

    // turnstile may not be available immediately after script load
    const w = window as unknown as { turnstile?: TurnstileAPI };
    if (!w.turnstile) return;

    // Clean up any existing widget
    if (widgetIdRef.current != null) {
      w.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = w.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onVerifyRef.current(token),
      "expired-callback": () => onExpireRef.current?.(),
      "error-callback": () => onErrorRef.current?.(),
      theme: "dark",
    });
  }, [siteKey]);

  useEffect(() => {
    renderWidget();

    return () => {
      if (widgetIdRef.current != null) {
        const w = window as unknown as { turnstile?: TurnstileAPI };
        w.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  if (!siteKey) return null;

  return <div ref={containerRef} />;
}

interface TurnstileAPI {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}
