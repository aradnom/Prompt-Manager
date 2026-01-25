import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

  const commaSeparated = activeStack?.commaSeparated ?? false

  const updateStackMutation = api.stacks.update.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await utils.stacks.get.cancel({ id: variables.id })

      // Snapshot the previous value
      const previousStack = utils.stacks.get.getData({ id: variables.id })

      // Optimistically update to the new value
      if (previousStack) {
        utils.stacks.get.setData({ id: variables.id }, {
          ...previousStack,
          commaSeparated: variables.commaSeparated ?? previousStack.commaSeparated,
        })
      }

      return { previousStack }
    },
    onError: (_err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousStack) {
        utils.stacks.get.setData({ id: variables.id }, context.previousStack)
      }
    },
    onSuccess: (_data, variables) => {
      if (activeStack) {
        utils.stacks.get.invalidate({ id: variables.id })
      }
    },
  })

  const updateBlockMutation = api.blocks.update.useMutation({
    onSuccess: () => {
      // Refetch the stack to update the rendered content
      if (activeStack) {
        utils.stacks.get.invalidate({ id: activeStack.id })
      }
    },
  })

  const handleCommaSeparatedChange = (checked: boolean) => {
    if (!activeStack) return
    updateStackMutation.mutate({
      id: activeStack.id,
      commaSeparated: checked,
    })
  }

  // Process content to add trailing commas if enabled
  const getProcessedContent = (content: string): string => {
    if (!commaSeparated) return content

    // Split by double newline to get individual blocks
    const blocks = content.split('\n\n')

    // Add trailing comma to each block if it doesn't already have one
    const processedBlocks = blocks.map(block => {
      const trimmed = block.trimEnd()
      if (trimmed.length === 0) return block
      if (trimmed.endsWith(',')) return block
      if (trimmed.endsWith('.')) return trimmed.slice(0, -1) + ','
      return trimmed + ','
    })

    return processedBlocks.join('\n\n')
  }

  const processedContent = getProcessedContent(renderedContent)
  const processedContentWithMarkers = getProcessedContent(renderedContentWithMarkers)

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API not available (requires HTTPS or localhost)')
      }
      await navigator.clipboard.writeText(processedContent)
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
    <Card className={`border-2 border-magenta-medium shadow-lg bg-background ${isMinimized ? 'w-fit ml-auto border-cyan-medium' : ''}`}>
      <CardHeader className={`bg-magenta-dark/5 transition-[padding] ${isMinimized ? 'p-2' : ''}`}>
        <div className={`flex items-center ${isMinimized ? 'justify-end' : 'justify-between'}`}>
          {!isMinimized && <CardTitle className="text-xl font-bold">Prompt Output</CardTitle>}
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={commaSeparated}
                onCheckedChange={handleCommaSeparatedChange}
                className="cursor-pointer"
              />
              Comma Separated
            </label>
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
              variant={isMinimized ? "outline" : "outline-magenta"}
              size="xs"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Maximize" : "Minimize"}
              className="absolute -right-2 -top-3"
            >
              {isMinimized ? (
                <Maximize2 className="h-4! w-4!" />
              ) : (
                <Minimize2 className="h-4! w-4!" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isMinimized && (
        <CardContent className="pt-6 max-h-48 overflow-y-auto">
          <TextWithWildcards
            text={processedContentWithMarkers}
            className="text-base whitespace-pre-wrap font-mono"
            valueOnly={true}
          />
        </CardContent>
      )}
    </Card>
  )
}
