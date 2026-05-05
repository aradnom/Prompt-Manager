import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode } from "react";
import { GripVertical } from "lucide-react";

interface SortableBlockProps {
  id: string;
  children: ReactNode;
  suppressTransform?: boolean;
  dropIndicator?: "above" | "below" | null;
  indicatorColor?: string;
  compactHandle?: boolean;
}

export function SortableBlock({
  id,
  children,
  suppressTransform,
  dropIndicator,
  indicatorColor,
  compactHandle,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({ id });

  const style = {
    transform: suppressTransform
      ? undefined
      : CSS.Translate.toString(transform),
    transition: suppressTransform ? "none" : transition,
    opacity: isDragging ? 0 : 1,
  };

  const lineColor = indicatorColor ?? "var(--color-magenta-light)";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative group"
    >
      {dropIndicator === "above" && (
        <div
          className="absolute left-0 right-0 -top-2 h-0.5 rounded-full pointer-events-none z-30"
          style={{
            backgroundColor: lineColor,
            boxShadow: `0 0 6px ${lineColor}`,
          }}
        />
      )}
      <button
        {...listeners}
        className={
          compactHandle
            ? "absolute -left-4 top-1/2 -translate-y-1/2 z-10 p-0 hover:bg-cyan-dark transition-colors opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
            : "absolute -left-6 top-1/2 -translate-y-1/2 z-10 p-0.5 hover:bg-cyan-dark transition-colors opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        }
        aria-label="Drag to reorder"
      >
        <GripVertical
          className={
            compactHandle
              ? "h-4 w-4 text-cyan-medium"
              : "h-5 w-5 text-cyan-medium"
          }
        />
      </button>
      <div
        className="pl-0"
        style={isSorting ? { pointerEvents: "none" } : undefined}
      >
        {children}
      </div>
      {dropIndicator === "below" && (
        <div
          className="absolute left-0 right-0 -bottom-2 h-0.5 rounded-full pointer-events-none z-30"
          style={{
            backgroundColor: lineColor,
            boxShadow: `0 0 6px ${lineColor}`,
          }}
        />
      )}
    </div>
  );
}
