import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Search, Sparkles, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { BlockStack, StackWithBlocks } from '@/types/schema'
import { useActiveStack } from '@/contexts/ActiveStackContext'
import { useStackContent } from '@/contexts/StackContentContext'
import { resolveWildcardsInText, resolveWildcardsWithMarkers } from '@/lib/wildcard-resolver'
import { api } from '@/lib/api'
import { generateDisplayId } from '@/lib/generate-display-id'
import { generateUUID } from '@/lib/uuid'
import { calculateNonOverlappingPositions } from '@/lib/layout-utils'
import { TextBlock } from '@/components/TextBlock'
import { BlockForm, BlockFormValues } from '@/components/BlockForm'
import { BlockSearchDialog } from '@/components/BlockSearchDialog'
import { SortableBlock } from '@/components/SortableBlock'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSettings } from '@/contexts/SettingsContext'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'

interface StackEditorProps {
  stack: BlockStack
}

export function StackEditor({ stack }: StackEditorProps) {
  const { setActiveStack, setActiveStackBlocks } = useActiveStack()
  const { setRenderedContent, setRenderedContentWithMarkers } = useStackContent()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null)
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedBlockIndices, setSelectedBlockIndices] = useState<Set<number>>(new Set())
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [generateConcept, setGenerateConcept] = useState('')
  const [generateResults, setGenerateResults] = useState<string[]>([])
  const [isEditingConcept, setIsEditingConcept] = useState(false)
  const { preferredLLMTarget } = useSettings()

  const { data: fullStack, isLoading, refetch } = api.stacks.get.useQuery({
    id: stack.id,
    includeBlocks: true,
  })

  const { data: wildcards } = api.wildcards.list.useQuery()
  const { data: serverConfig } = api.config.getSettings.useQuery()

  const updateContentMutation = api.stacks.updateContent.useMutation()
  const generateMutation = api.llm.transform.useMutation()

  const saveContent = useCallback((stackId: number, content: string) => {
    updateContentMutation.mutate({
      stackId,
      renderedContent: content,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const llmTarget = useMemo(() => {
    const targets = serverConfig?.llm?.allowedTargets
    if (!targets || targets.length === 0) return 'lm-studio'

    // Use preference if valid, otherwise fallback to first available
    if (preferredLLMTarget && targets.includes(preferredLLMTarget)) {
      return preferredLLMTarget as 'lm-studio' | 'vertex' | 'openai' | 'anthropic'
    }

    // Default fallback: Prefer vertex if available, otherwise first allowed
    return (targets.includes('vertex') ? 'vertex' : targets[0]) as 'lm-studio' | 'vertex' | 'openai' | 'anthropic'
  }, [serverConfig, preferredLLMTarget])

  // We cast here because we know we requested includeBlocks: true
  const stackWithBlocks = fullStack as StackWithBlocks

  // Update context whenever blocks change
  useEffect(() => {
    if (stackWithBlocks?.blocks) {
      setActiveStackBlocks(stackWithBlocks.blocks)
      
      // Compute rendered content
      const rawText = stackWithBlocks.blocks
        .map(b => b.text.trim())
        .filter(t => t.length > 0)
        .join('\n\n') // Using double newline as requested
      
      const newRenderedContent = wildcards ? resolveWildcardsInText(rawText, wildcards) : rawText

      if (wildcards) {
        setRenderedContent(newRenderedContent)
        setRenderedContentWithMarkers(resolveWildcardsWithMarkers(rawText, wildcards))
      } else {
        setRenderedContent(rawText)
        setRenderedContentWithMarkers(rawText)
      }

      // Save the rendered content to the revision (debounced)
      const timeoutId = setTimeout(() => {
        saveContent(stack.id, newRenderedContent)
      }, 500)

      return () => clearTimeout(timeoutId)
    }
  }, [stackWithBlocks?.blocks, setActiveStackBlocks, wildcards, setRenderedContent, setRenderedContentWithMarkers, stack.id, saveContent])

  const addBlockMutation = api.stacks.addBlock.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  const createBlockMutation = api.blocks.create.useMutation()

  const updateBlockMutation = api.blocks.update.useMutation({
    onSuccess: () => {
      refetch()
      setEditingBlockId(null)
    },
  })

  const removeBlockMutation = api.stacks.removeBlock.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  const reorderBlocksMutation = api.stacks.reorderBlocks.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const generatePositions = useMemo(() => {
    if (generateResults.length === 0) return []

    return calculateNonOverlappingPositions({
      count: generateResults.length,
      centerX: 0,
      centerY: 0,
      centerWidth: 500,
      centerHeight: 100,
      itemWidth: 450,
      itemHeight: 100,
      radius: 300,
      margin: 40,
    })
  }, [generateResults.length])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || !stackWithBlocks?.blocks) {
      return
    }

    const oldIndex = stackWithBlocks.blocks.findIndex((block) => block.id === active.id)
    const newIndex = stackWithBlocks.blocks.findIndex((block) => block.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reorderedBlocks = arrayMove(stackWithBlocks.blocks, oldIndex, newIndex)
    const blockIds = reorderedBlocks.map((block) => block.id)

    reorderBlocksMutation.mutate({
      stackId: stack.id,
      blockIds,
    })
  }

  const handleAddExistingBlock = (blockId: number) => {
    addBlockMutation.mutate({
      stackId: stack.id,
      blockId,
    })
  }

  const handleCreateNewBlock = async (values: BlockFormValues) => {
    try {
      // 1. Create the block
      const newBlock = await createBlockMutation.mutateAsync({
        uuid: generateUUID(),
        name: values.name,
        displayId: values.displayId,
        text: values.text,
        labels: values.labels,
        typeId: values.typeId,
      })

      // 2. Add to stack
      await addBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId: newBlock.id,
      })

      setIsCreatingNew(false)
    } catch (error) {
      console.error('Failed to create and add block:', error)
      // Error handling (toast notification could go here)
    }
  }

  const handleUpdateBlock = async (blockId: number, values: BlockFormValues) => {
    try {
      await updateBlockMutation.mutateAsync({
        id: blockId,
        name: values.name,
        displayId: values.displayId,
        text: values.text,
        labels: values.labels,
        typeId: values.typeId,
      })
    } catch (error) {
      console.error('Failed to update block:', error)
    }
  }

  const handleRemoveBlock = (blockId: number) => {
    removeBlockMutation.mutate({
      stackId: stack.id,
      blockId,
    })
  }

  const handleToggleBlockSelection = (index: number) => {
    setSelectedBlockIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleRemoveSelectedBlocks = async () => {
    if (!stackWithBlocks?.blocks) return

    // Get block IDs from selected indices
    const blockIdsToRemove = Array.from(selectedBlockIndices).map(
      (index) => stackWithBlocks.blocks[index].id
    )

    // Remove each block
    for (const blockId of blockIdsToRemove) {
      await removeBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId,
      })
    }

    // Clear selection
    setSelectedBlockIndices(new Set())
  }

  const handleMergeBlocks = async () => {
    if (!stackWithBlocks?.blocks || selectedBlockIndices.size < 2) return

    // Get sorted indices to maintain stack order
    const sortedIndices = Array.from(selectedBlockIndices).sort((a, b) => a - b)

    // Get the blocks in order
    const blocksToMerge = sortedIndices.map((index) => stackWithBlocks.blocks[index])

    // Merge the text content with smart comma joining
    const mergedText = blocksToMerge.reduce((acc, block, index) => {
      if (index === 0) return block.text

      // Check if previous text ends with comma or period
      const needsComma = !/[,.]$/.test(acc)
      return needsComma ? `${acc}, ${block.text}` : `${acc} ${block.text}`
    }, '')

    // Get type from first block that has one
    const mergedTypeId = blocksToMerge.find((block) => block.typeId !== null)?.typeId

    // Collect all unique labels from all blocks
    const allLabels = blocksToMerge.flatMap((block) => block.labels)
    const uniqueLabels = Array.from(new Set(allLabels))

    // Create new block with merged content
    const newBlock = await createBlockMutation.mutateAsync({
      uuid: generateUUID(),
      displayId: generateDisplayId(),
      text: mergedText,
      labels: uniqueLabels,
      typeId: mergedTypeId ?? undefined,
    })

    // Get the position of the first selected block
    const firstPosition = sortedIndices[0]

    // Add the new block at that position
    await addBlockMutation.mutateAsync({
      stackId: stack.id,
      blockId: newBlock.id,
      order: firstPosition,
    })

    // Remove all the merged blocks from the stack
    for (const index of sortedIndices) {
      const blockId = stackWithBlocks.blocks[index].id
      await removeBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId,
      })
    }

    // Clear selection and exit select mode
    setSelectedBlockIndices(new Set())
    setIsSelectMode(false)
  }

  const handleGenerateOpen = () => {
    setIsGenerateOpen(true)
    setGenerateConcept('')
    setGenerateResults([])
    setIsEditingConcept(false)
  }

  const handleGenerateSubmit = async () => {
    if (!generateConcept.trim()) return

    try {
      const result = await generateMutation.mutateAsync({
        text: generateConcept,
        operation: 'generate',
        target: llmTarget,
      })

      if (Array.isArray(result.result)) {
        setGenerateResults(result.result)
      }
      setIsEditingConcept(false)
    } catch (error) {
      console.error('Generate failed:', error)
    }
  }

  const handleConceptClick = () => {
    setIsEditingConcept(true)
  }

  const handleSelectGenerated = async (text: string) => {
    try {
      // Create new block
      const newBlock = await createBlockMutation.mutateAsync({
        uuid: generateUUID(),
        displayId: generateDisplayId(),
        text: text,
        labels: [],
        typeId: undefined,
      })

      // Add to stack
      await addBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId: newBlock.id,
      })

      setIsGenerateOpen(false)
    } catch (error) {
      console.error('Failed to create generated block:', error)
    }
  }

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Active Stack: {stack.displayId}</CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                {stack.uuid}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSelectMode(!isSelectMode)
                  setSelectedBlockIndices(new Set())
                }}
              >
                {isSelectMode ? 'Cancel Select' : 'Select Blocks'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveStack(null)}
              >
                Close Stack
              </Button>
            </div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {isSelectMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-b overflow-hidden"
            >
              <div className="px-6 py-3 bg-muted/30">
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveSelectedBlocks}
                    disabled={selectedBlockIndices.size === 0}
                  >
                    Remove Blocks
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleMergeBlocks}
                    disabled={selectedBlockIndices.size < 2}
                  >
                    Merge Blocks
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <CardContent className="flex-1">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading blocks...
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="flex flex-col gap-4">
                  {stackWithBlocks?.blocks && stackWithBlocks.blocks.length > 0 ? (
                    <SortableContext
                      items={stackWithBlocks.blocks.map((block) => block.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {stackWithBlocks.blocks.map((block, index) => (
                        <SortableBlock key={block.id} id={block.id}>
                          {editingBlockId === block.id ? (
                            <motion.div
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 16 }}
                              transition={{ duration: 0.2 }}
                            >
                              <BlockForm
                                mode="edit"
                                initialValues={{
                                  name: block.name ?? undefined,
                                  displayId: block.displayId,
                                  text: block.text,
                                  labels: block.labels,
                                  typeId: block.typeId ?? undefined,
                                }}
                                onSubmit={(values) => handleUpdateBlock(block.id, values)}
                                onCancel={() => setEditingBlockId(null)}
                                isSubmitting={updateBlockMutation.isPending}
                              />
                            </motion.div>
                          ) : (
                            <TextBlock
                              block={block}
                              onEdit={() => setEditingBlockId(block.id)}
                              onDelete={() => handleRemoveBlock(block.id)}
                              onTransform={(blockId, transformedText) =>
                                handleUpdateBlock(blockId, {
                                  name: block.name ?? undefined,
                                  displayId: block.displayId,
                                  text: transformedText,
                                  labels: block.labels,
                                  typeId: block.typeId ?? undefined,
                                })
                              }
                              onSelectBlock={handleAddExistingBlock}
                              isDeleting={removeBlockMutation.isPending}
                              isSelectMode={isSelectMode}
                              isSelected={selectedBlockIndices.has(index)}
                              onToggleSelect={() => handleToggleBlockSelection(index)}
                            />
                          )}
                        </SortableBlock>
                      ))}
                    </SortableContext>
                  ) : !isCreatingNew && (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p>No blocks in this stack yet.</p>
                      <p className="text-xs mt-2">Add blocks using the toolbar below.</p>
                    </div>
                  )}

                  {isCreatingNew && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.2 }}
                    >
                      <BlockForm
                        onSubmit={handleCreateNewBlock}
                        onCancel={() => setIsCreatingNew(false)}
                        isSubmitting={createBlockMutation.isPending || addBlockMutation.isPending}
                      />
                    </motion.div>
                  )}
                </div>
              </DndContext>
            )}
          </div>
        </CardContent>
        <CardFooter className="border-t p-4 bg-muted/20 gap-2">
            {!isCreatingNew && (
              <>
                <Button onClick={() => setIsSearchOpen(true)} variant="secondary" className="w-full sm:w-auto">
                    <Search className="mr-2 h-4 w-4" />
                    Add Existing Block
                </Button>
                <Button onClick={() => setIsCreatingNew(true)} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Block
                </Button>
                <Button onClick={handleGenerateOpen} variant="secondary" className="w-full sm:w-auto">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate New Block
                </Button>
              </>
            )}
        </CardFooter>
      </Card>
      
      <BlockSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={handleAddExistingBlock}
      />

      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] h-full w-full flex flex-col">
          <DialogHeader>
            <DialogTitle>Generate New Block</DialogTitle>
            <DialogDescription>
              {generateResults.length === 0 ? 'Enter a concept or idea to generate suggestions' : `${generateResults.length} suggestions generated`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center p-8">
            {generateResults.length === 0 ? (
              <div className="w-full max-w-md space-y-4">
                <input
                  type="text"
                  value={generateConcept}
                  onChange={(e) => setGenerateConcept(e.target.value.slice(0, 140))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !generateMutation.isPending) {
                      handleGenerateSubmit()
                    }
                  }}
                  placeholder="Enter a concept (e.g., 'landscape', 'action scenes')"
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  maxLength={140}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {generateConcept.length}/140 characters
                  </span>
                  <Button
                    onClick={handleGenerateSubmit}
                    disabled={!generateConcept.trim() || generateMutation.isPending}
                  >
                    {generateMutation.isPending ? 'Generating...' : 'Generate'}
                  </Button>
                </div>
              </div>
            ) : generateMutation.isPending ? (
              <LoadingSpinner />
            ) : (
              <div className="relative w-full h-full">
                {/* Spokes from center to suggestions */}
                {generateResults.map((_, index) => {
                  const position = generatePositions[index]
                  if (!position) return null

                  const angle = Math.atan2(position.y, position.x) * 180 / Math.PI
                  const length = Math.sqrt(position.x * position.x + position.y * position.y)

                  return (
                    <motion.div
                      key={`spoke-${index}`}
                      className="absolute origin-left pointer-events-none border-t-2 border-dashed border-border"
                      style={{
                        top: '50%',
                        left: '50%',
                        zIndex: 5,
                      }}
                      initial={{ width: 0, opacity: 0, rotate: angle }}
                      animate={{ width: length, opacity: 0.5, rotate: angle }}
                      transition={{
                        delay: index * 0.1,
                        duration: 0.4,
                        ease: "easeOut",
                      }}
                    />
                  )
                })}

                {/* Concept in center */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[100px] flex items-center justify-center" style={{ zIndex: 10 }}>
                  <div className="p-4 border-2 border-primary rounded-md bg-card w-full h-full flex items-center justify-center relative">
                    <button
                      onClick={handleGenerateSubmit}
                      disabled={generateMutation.isPending}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                      title="Regenerate suggestions"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    {isEditingConcept ? (
                      <input
                        type="text"
                        value={generateConcept}
                        onChange={(e) => setGenerateConcept(e.target.value.slice(0, 140))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !generateMutation.isPending) {
                            handleGenerateSubmit()
                          }
                        }}
                        onBlur={() => setIsEditingConcept(false)}
                        className="w-full text-sm text-center font-semibold bg-transparent border-none focus:outline-none"
                        maxLength={140}
                        autoFocus
                      />
                    ) : (
                      <p
                        className="text-sm font-semibold text-center line-clamp-3 cursor-pointer hover:text-primary/80 transition-colors"
                        onClick={handleConceptClick}
                      >
                        {generateConcept}
                      </p>
                    )}
                  </div>
                </div>

                {/* Suggestions shooting out in a star pattern */}
                {generateResults.map((suggestion, index) => {
                  const position = generatePositions[index]
                  if (!position) return null

                  return (
                    <motion.div
                      key={index}
                      className="absolute top-1/2 left-1/2 w-[450px] h-[100px] cursor-pointer"
                      style={{ zIndex: 10 }}
                      initial={{ x: -225, y: -50, scale: 0, opacity: 0 }}
                      animate={{
                        x: position.x - 225,
                        y: position.y - 50,
                        scale: 1,
                        opacity: 1
                      }}
                      transition={{
                        delay: index * 0.1,
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                      }}
                      onClick={() => handleSelectGenerated(suggestion)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="p-4 border rounded-md bg-muted w-full h-full flex items-center justify-center hover:bg-muted/80 transition-colors">
                        <p className="text-sm text-center line-clamp-3">
                          {suggestion}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}



