import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode } from "react";
import { GripVertical } from "lucide-react";

interface DraggableItemProps {
  id: string;
  inFolder?: boolean;
  currentFolderId?: number | null;
  children: ReactNode;
}

export function DraggableItem({
  id,
  inFolder,
  currentFolderId,
  children,
}: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, data: { currentFolderId } });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="group">
      <button
        {...listeners}
        className={`absolute ${inFolder ? "-left-5" : "-left-6"} top-1/2 -translate-y-1/2 z-10 p-0.5 hover:bg-cyan-dark transition-colors opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing`}
        aria-label="Drag to folder"
      >
        <GripVertical className="h-5 w-5 text-cyan-medium" />
      </button>
      {children}
    </div>
  );
}
