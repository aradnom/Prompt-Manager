import { useState, useRef } from 'react'
import { generateDisplayId } from '@/lib/generate-display-id'
import { useTypes } from '@/contexts/TypesContext'
import { insertWildcard } from '@/lib/wildcard-parser'
import { Button } from '@/components/ui/button'
import { DisplayIdInput } from '@/components/ui/display-id-input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { WildcardBrowser } from '@/components/WildcardBrowser'

export interface BlockFormValues {
  displayId: string
  text: string
  labels: string[]
  typeId?: number
}

interface BlockFormProps {
  initialValues?: Partial<BlockFormValues>
  onSubmit: (values: BlockFormValues) => void
  onCancel: () => void
  isSubmitting?: boolean
  mode?: 'create' | 'edit'
}

export function BlockForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create'
}: BlockFormProps) {
  const { types } = useTypes()
  const [displayId, setDisplayId] = useState(initialValues?.displayId || generateDisplayId())
  const [text, setText] = useState(initialValues?.text || '')
  const [labels, setLabels] = useState(initialValues?.labels?.join(', ') || '')
  const [typeId, setTypeId] = useState<number | undefined>(initialValues?.typeId)
  const [wildcardBrowserOpen, setWildcardBrowserOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (!displayId.trim() || !text.trim()) return

    onSubmit({
      displayId: displayId.trim(),
      text: text.trim(),
      labels: labels.trim() ? labels.split(',').map(l => l.trim()) : [],
      typeId,
    })
  }

  const handleWildcardSelect = (displayId: string, path?: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPosition = textarea.selectionStart || text.length
    const result = insertWildcard(text, cursorPosition, displayId, path)

    setText(result.text)

    // Set cursor position after the inserted wildcard
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(result.newCursorPosition, result.newCursorPosition)
    }, 0)
  }

  return (
    <Card className="bg-muted">
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Create New Block' : 'Edit Block'}</CardTitle>
        <CardDescription>
          {mode === 'create' ? 'Enter details for your new text block' : 'Update block details'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Display ID
            </label>
            <div className="flex gap-2">
              <DisplayIdInput
                placeholder="e.g., mountain-scene-v1"
                className="flex-1"
                value={displayId}
                onChange={setDisplayId}
                disabled={isSubmitting}
              />
              <Button
                variant="outline"
                onClick={() => setDisplayId(generateDisplayId())}
                type="button"
                disabled={isSubmitting}
              >
                Regenerate
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Type
            </label>
            <select
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
              value={typeId || ''}
              onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : undefined)}
              disabled={isSubmitting}
            >
              <option value="">None</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Text
            </label>
            <textarea
              ref={textareaRef}
              placeholder="Enter your prompt text..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background min-h-[120px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setWildcardBrowserOpen(true)}
              disabled={isSubmitting}
            >
              Insert Wildcard
            </Button>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Labels (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g., scene, landscape, outdoor"
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex gap-4">
            <Button onClick={handleSubmit} disabled={isSubmitting || !displayId.trim() || !text.trim()}>
              {isSubmitting ? (mode === 'create' ? 'Creating...' : 'Saving...') : (mode === 'create' ? 'Create' : 'Save')}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>

      <WildcardBrowser
        open={wildcardBrowserOpen}
        onOpenChange={setWildcardBrowserOpen}
        onSelect={handleWildcardSelect}
      />
    </Card>
  )
}
