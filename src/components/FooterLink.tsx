import { Github } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function FooterLink() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      const rect = ref.current!.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const padX = 6;
  const padY = 6;

  return (
    <a
      ref={ref}
      href="https://github.com/aradnom"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative inline-flex items-center gap-1.5 text-sm text-cyan-medium/80 hover:text-cyan-medium transition-colors px-3 py-1.5 no-underline"
    >
      {/* Border trace */}
      {size.w > 0 && (
        <svg
          className="absolute pointer-events-none"
          style={{
            top: -padY,
            left: -padX,
            width: size.w + padX * 2,
            height: size.h + padY * 2,
          }}
          fill="none"
        >
          <rect
            x={1}
            y={1}
            width={size.w + padX * 2 - 2}
            height={size.h + padY * 2 - 2}
            rx={10}
            stroke="var(--color-magenta-light)"
            strokeWidth={1.5}
            pathLength={1}
            className="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-700 ease-in-out group-hover:[stroke-dashoffset:0]"
          />
        </svg>
      )}

      {/* GitHub icon with circle */}
      <span className="relative inline-flex items-center justify-center h-8 w-8 rounded-full border border-current overflow-hidden group-hover:border-magenta-light group-hover:bg-magenta-light transition-[border-color,background-color] duration-300">
        {/* Shine sweep */}
        <span className="absolute inset-0 bg-linear-to-tr from-transparent via-white to-transparent -translate-x-full translate-y-full group-hover:translate-x-full group-hover:-translate-y-full transition-transform duration-700 ease-in-out" />
        <Github className="h-4 w-4 relative z-10 group-hover:text-white transition-colors duration-300" />
      </span>

      <span className="footer-link-text transition-colors duration-300">
        Built by <span className="font-bold">@aradnom</span>
      </span>
    </a>
  );
}
