import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Dices, Minimize2, Maximize2 } from 'lucide-react'
import yaml from 'js-yaml'
import { TextWithWildcards } from '@/components/TextWithWildcards'
import { useStackContent } from '@/contexts/StackContentContext'
import { useActiveStack } from '@/contexts/ActiveStackContext'
import { useStackOutput } from '@/contexts/StackOutputContext'
import { useErrors } from '@/contexts/ErrorContext'
import { api } from '@/lib/api'
import { parseWildcards } from '@/lib/wildcard-parser'

export function StackOutputBlock() {
  const { isMinimized, setIsMinimized } = useStackOutput()
  const { renderedContent, renderedContentWithMarkers } = useStackContent()
  const { activeStack, activeStackBlocks } = useActiveStack()
  const { data: wildcards } = api.wildcards.list.useQuery()
  const { addError } = useErrors()
  const utils = api.useUtils()

  const updateBlockMutation = api.blocks.update.useMutation({
    onSuccess: () => {
      // Refetch the stack to update the rendered content
      if (activeStack) {
        utils.stacks.get.invalidate({ id: activeStack.id })
      }
    },
  })

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API not available (requires HTTPS or localhost)')
      }
      await navigator.clipboard.writeText(renderedContent)
    } catch (error) {
      addError(error instanceof Error ? error.message : 'Failed to copy to clipboard')
    }
  }

  const getRandomPathForWildcard = (displayId: string): string | null => {
    if (!wildcards) return null

    const wildcard = wildcards.find(w => w.displayId === displayId)
    if (!wildcard) return null

    const buildPath = (pathArray: string[]): string => {
      let result = ''
      pathArray.forEach((segment, idx) => {
        if (segment.startsWith('[')) {
          result += segment
        } else if (idx === 0) {
          result += segment
        } else {
          result += `.${segment}`
        }
      })
      return result
    }

    const collectAllLeaves = (obj: unknown, parentPath: string[] = []): Array<{ path: string; value: string }> => {
      const leaves: Array<{ path: string; value: string }> = []

      const traverse = (data: unknown, pathSoFar: string[]) => {
        if (Array.isArray(data)) {
          data.forEach((item, idx) => {
            const currentPath = [...pathSoFar, `[${idx}]`]
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
              leaves.push({ path: buildPath(currentPath), value: String(item) })
            } else {
              traverse(item, currentPath)
            }
          })
        } else if (typeof data === 'object' && data !== null) {
          const record = data as Record<string, unknown>
          Object.keys(record).forEach(key => {
            const value = record[key]
            const currentPath = [...pathSoFar, key]
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              leaves.push({ path: buildPath(currentPath), value: String(value) })
            } else {
              traverse(value, currentPath)
            }
          })
        }
      }

      traverse(obj, parentPath)
      return leaves
    }

    try {
      if (wildcard.format === 'json') {
        const data = JSON.parse(wildcard.content)
        const allLeaves = collectAllLeaves(data)
        if (allLeaves.length > 0) {
          return allLeaves[Math.floor(Math.random() * allLeaves.length)].path
        }
      } else if (wildcard.format === 'yaml') {
        const data = yaml.load(wildcard.content)
        const allLeaves = collectAllLeaves(data)
        if (allLeaves.length > 0) {
          return allLeaves[Math.floor(Math.random() * allLeaves.length)].path
        }
      } else if (wildcard.format === 'lines') {
        const lines = wildcard.content.split('\n').filter(l => l.trim())
        if (lines.length > 0) {
          const randomIndex = Math.floor(Math.random() * lines.length)
          return `[${randomIndex}]`
        }
      } else if (wildcard.format === 'text') {
        return ''
      }
    } catch (error) {
      console.error('Failed to get random path for wildcard:', displayId, error)
    }

    return null
  }

  const handleRandomizeWildcards = async () => {
    if (!activeStackBlocks || !wildcards) return

    // For each block, find all wildcards and replace them with random paths
    for (const block of activeStackBlocks) {
      const wildcardMatches = parseWildcards(block.text)

      if (wildcardMatches.length === 0) continue

      let updatedText = block.text

      // Replace each wildcard with a random path
      for (const match of wildcardMatches) {
        const randomPath = getRandomPathForWildcard(match.displayId)
        if (randomPath !== null) {
          const oldMarker = match.fullMatch
          const newMarker = `{{wildcard:${match.displayId}:${randomPath}}}`
          updatedText = updatedText.replace(oldMarker, newMarker)
        }
      }

      // Update the block if text changed
      if (updatedText !== block.text) {
        await updateBlockMutation.mutateAsync({
          id: block.id,
          text: updatedText,
        })
      }
    }
  }

  if (!renderedContent) {
    return null
  }

  return (
    <Card className={`border-2 border-primary shadow-lg bg-background ${isMinimized ? 'w-fit ml-auto' : ''}`}>
      <CardHeader className="bg-primary/5">
        <div className={`flex items-center ${isMinimized ? 'justify-end' : 'justify-between'}`}>
          {!isMinimized && <CardTitle className="text-xl font-bold">Stack Output</CardTitle>}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRandomizeWildcards}
              disabled={!activeStackBlocks || activeStackBlocks.length === 0}
              title="Randomize all wildcards"
            >
              <Dices className="mr-2 h-4 w-4" />
              Randomize Wildcards
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!renderedContent}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              {isMinimized ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isMinimized && (
        <CardContent className="pt-6 max-h-48 overflow-y-auto">
          <TextWithWildcards
            text={renderedContentWithMarkers}
            className="text-base whitespace-pre-wrap font-mono"
            valueOnly={true}
          />
        </CardContent>
      )}
    </Card>
  )
}
