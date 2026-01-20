import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { api } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BlockSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (blockId: number) => void
  typeId?: number
  labels?: string[]
}

export function BlockSearchDialog({ open, onOpenChange, onSelect, typeId, labels }: BlockSearchDialogProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('')
      setDebouncedSearch('')
    }
  }, [open])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  const { data: blocks, isLoading } = api.blocks.search.useQuery(
    {
      query: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      typeId,
      labels,
    },
    { enabled: debouncedSearch.length > 0 || typeId !== undefined || (labels && labels.length > 0) }
  )

  const filteredBlocks = blocks || []

  // Get type name if filtering by type
  const typeName = filteredBlocks[0]?.type?.name

  // Build title based on filters
  const getTitle = () => {
    if (typeId && typeName) return `Blocks: ${typeName}`
    if (labels && labels.length > 0) return `Blocks: ${labels.join(', ')}`
    return 'Add Block'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        {!typeId && !labels && (
          <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                 className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-cyan-medium disabled:cursor-not-allowed disabled:opacity-50"
                 placeholder="Search blocks..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 autoFocus
              />
          </div>
        )}
        <div className="max-h-[300px] overflow-y-auto p-2">
            {isLoading ? (
                <div className="text-center py-6 text-sm text-cyan-medium">
                    Searching...
                </div>
            ) : filteredBlocks.length > 0 ? (
                filteredBlocks.map(block => (
                    <div
                        key={block.id}
                        className="flex flex-col p-2 rounded-md hover:bg-cyan-dark cursor-pointer group"
                        onClick={() => {
                            onSelect(block.id)
                            onOpenChange(false)
                        }}
                    >
                        <span className="font-medium">{block.displayId}</span>
                        <span className="text-xs text-cyan-medium truncate group-hover:text-foreground">
                            {block.text}
                        </span>
                    </div>
                ))
            ) : debouncedSearch.length > 0 || typeId !== undefined || (labels && labels.length > 0) ? (
                <div className="text-center py-6 text-sm text-cyan-medium">
                    No blocks found.
                </div>
            ) : (
                <div className="text-center py-6 text-sm text-cyan-medium">
                    Start typing to search blocks...
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
