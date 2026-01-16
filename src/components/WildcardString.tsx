import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Dices } from 'lucide-react'
import yaml from 'js-yaml'
import { Wildcard } from '@/types/schema'
import { resolveWildcardPath } from '@/lib/wildcard-value-extractor'
import { WildcardBrowserLists } from '@/components/WildcardBrowserLists'

interface WildcardStringProps {
  wildcard: Wildcard | null
  displayId: string
  path: string
  valueOnly?: boolean
  enableTooltip?: boolean
  onPathChange?: (displayId: string, oldPath: string, newPath: string) => void
}

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export function WildcardString({ wildcard, displayId, path, valueOnly = false, enableTooltip = false, onPathChange }: WildcardStringProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>('top')
  const spanRef = useRef<HTMLSpanElement>(null)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const allChoices = useMemo(() => {
    if (!wildcard) return []

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
        return collectAllLeaves(data)
      } else if (wildcard.format === 'yaml') {
        const data = yaml.load(wildcard.content)
        return collectAllLeaves(data)
      } else if (wildcard.format === 'lines') {
        const lines = wildcard.content.split('\n').filter(l => l.trim())
        return lines.map((line, idx) => ({ path: `[${idx}]`, value: line }))
      } else if (wildcard.format === 'text') {
        return [{ path: '', value: wildcard.content }]
      }
    } catch (error) {
      console.error('Failed to parse wildcard choices:', error)
    }

    return []
  }, [wildcard])

  const calculateTooltipPosition = (): TooltipPosition => {
    if (!spanRef.current) return 'top'

    const rect = spanRef.current.getBoundingClientRect()
    const tooltipHeight = 300 // Expected tooltip height
    const tooltipWidth = 400 // Expected tooltip width
    const padding = 20

    // Check top
    if (rect.top - tooltipHeight - padding >= 0) {
      return 'top'
    }

    // Check bottom
    if (rect.bottom + tooltipHeight + padding <= window.innerHeight) {
      return 'bottom'
    }

    // Check left
    if (rect.left - tooltipWidth - padding >= 0) {
      return 'left'
    }

    // Check right
    if (rect.right + tooltipWidth + padding <= window.innerWidth) {
      return 'right'
    }

    // Default to top if no good position
    return 'top'
  }

  const handleMouseEnter = () => {
    if (!enableTooltip) return
    const position = calculateTooltipPosition()
    setTooltipPosition(position)
    setShowTooltip(true)
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
  }

  const getCurrentValue = (wildcard: Wildcard, path: string): string => {
    const maxLength = 40

    if (path) {
      const resolved = resolveWildcardPath(wildcard.content, wildcard.format, path)
      if (resolved) {
        return resolved.length > maxLength ? resolved.substring(0, maxLength) + '...' : resolved
      }
    }

    // Fallback to old behavior if no path or resolution fails
    switch (wildcard.format) {
      case 'json': {
        try {
          const parsed = JSON.parse(wildcard.content)
          const preview = JSON.stringify(parsed)
          return preview.length > maxLength ? preview.substring(0, maxLength) + '...' : preview
        } catch {
          return wildcard.content.substring(0, maxLength) + '...'
        }
      }
      case 'yaml':
      case 'text': {
        const firstLine = wildcard.content.split('\n')[0]
        return firstLine.length > maxLength ? firstLine.substring(0, maxLength) + '...' : firstLine
      }
      case 'lines': {
        const lines = wildcard.content.split('\n').filter(l => l.trim())
        return lines.length > 0 ? lines[0] : wildcard.content.substring(0, maxLength)
      }
      default:
        return wildcard.content.substring(0, maxLength)
    }
  }

  const textSizeClass = valueOnly ? '' : 'text-sm'

  const getTooltipPositionClasses = (): string => {
    switch (tooltipPosition) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2'
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2'
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2'
    }
  }

  const getBridgeClasses = (): string => {
    // Invisible bridge to prevent tooltip from closing when moving mouse to it
    switch (tooltipPosition) {
      case 'top':
        return 'bottom-full left-0 right-0 h-2 mb-0'
      case 'bottom':
        return 'top-full left-0 right-0 h-2 mt-0'
      case 'left':
        return 'right-full top-0 bottom-0 w-2 mr-0'
      case 'right':
        return 'left-full top-0 bottom-0 w-2 ml-0'
    }
  }

  if (!wildcard) {
    return (
      <span
        ref={spanRef}
        className={`inline-block px-2 py-0.5 rounded bg-destructive/20 text-destructive ${textSizeClass} font-mono`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {valueOnly ? '[not found]' : `${displayId}: [not found]`}
      </span>
    )
  }

  const value = getCurrentValue(wildcard, path)

  const handleRandomSelection = () => {
    if (!onPathChange || allChoices.length === 0) return

    const randomChoice = allChoices[Math.floor(Math.random() * allChoices.length)]
    onPathChange(displayId, path, randomChoice.path)
    setShowTooltip(false)
  }

  return (
    <span
      ref={spanRef}
      className={`relative inline-block px-2 py-0.5 rounded bg-primary/20 text-primary ${textSizeClass} font-mono ${enableTooltip ? 'cursor-pointer' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {valueOnly ? value : `${displayId}: ${value}`}

      <AnimatePresence>
        {enableTooltip && showTooltip && (
          <>
            {/* Invisible bridge to prevent tooltip from closing */}
            <motion.div
              className={`absolute ${getBridgeClasses()} z-50`}
              onMouseEnter={handleMouseEnter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />

            <motion.div
              className={`absolute ${getTooltipPositionClasses()} z-50 w-[500px] max-h-[400px] overflow-y-auto bg-card border border-border rounded-lg shadow-xl p-4`}
              onMouseEnter={handleMouseEnter}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-sm text-foreground">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-semibold">{wildcard.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{displayId}</div>
                  </div>
                  <button
                    onClick={handleRandomSelection}
                    className="p-2 rounded border border-border hover:bg-muted/80 transition-colors"
                    title="Random selection"
                  >
                    <Dices className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4" />

                <WildcardBrowserLists
                  wildcard={wildcard}
                  currentPath={path}
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  onSelectValue={(newPath, _value) => {
                    if (onPathChange) {
                      onPathChange(displayId, path, newPath)
                    }
                    setShowTooltip(false)
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  )
}
