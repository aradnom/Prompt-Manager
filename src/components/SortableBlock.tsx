import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ReactNode } from 'react'
import { GripVertical } from 'lucide-react'

interface SortableBlockProps {
  id: number
  children: ReactNode
}

export function SortableBlock({ id, children }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group">
      <button
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 rounded hover:bg-cyan-dark transition-colors opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5 text-cyan-medium" />
      </button>
      <div className="pl-8">
        {children}
      </div>
    </div>
  )
}
