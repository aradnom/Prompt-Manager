import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import yaml from 'js-yaml'
import { Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { generateUUID } from '@/lib/uuid'
import { generateDisplayId } from '@/lib/generate-display-id'
import { useErrors } from '@/contexts/ErrorContext'
import { validateWildcardContent } from '@/lib/wildcard-validation'
import { useSettings } from '@/contexts/SettingsContext'
import { RasterIcon } from '@/components/RasterIcon'
import { Button } from '@/components/ui/button'
import { DisplayIdInput } from '@/components/ui/display-id-input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { WildcardContentEditor } from '@/components/WildcardContentEditor'

interface WildcardFormValues {
  displayId: string
  name: string
  format: string
  content: string
}

interface WildcardFormProps {
  mode: 'create' | 'edit'
  initialValues?: WildcardFormValues
  onSubmit: (values: WildcardFormValues) => void
  onCancel: () => void
  isSubmitting: boolean
}

function WildcardForm({ mode, initialValues, onSubmit, onCancel, isSubmitting }: WildcardFormProps) {
  const { addError } = useErrors()
  const [displayId, setDisplayId] = useState(initialValues?.displayId || '')
  const [name, setName] = useState(initialValues?.name || '')
  const [format, setFormat] = useState(initialValues?.format || 'json')
  const [content, setContent] = useState(initialValues?.content || '')

  const validateContent = (): boolean => {
    // First run global validation
    const globalValidation = validateWildcardContent(content)
    if (!globalValidation.valid) {
      addError(globalValidation.error!)
      return false
    }

    // Then run format-specific validation
    try {
      switch (format) {
        case 'json':
          JSON.parse(content)
          break
        case 'yaml':
          yaml.load(content)
          break
        // 'lines' and 'text' don't need format-specific validation
      }
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      addError(`Invalid ${format.toUpperCase()}: ${errorMessage}`)
      return false
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateContent()) {
      return
    }

    onSubmit({ displayId, name, format, content })
  }

  return (
    <Card className="bg-cyan-dark">
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Create Wildcard' : 'Edit Wildcard'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Display ID</label>
              <DisplayIdInput
                value={displayId}
                onChange={setDisplayId}
                placeholder="unique-id"
                className="w-full"
                required
                disabled={isSubmitting}
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-2 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Wildcard"
              className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
              disabled={isSubmitting}
            >
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
              <option value="lines">Lines</option>
              <option value="text">Plain Text</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Content</label>
            <WildcardContentEditor
              value={content}
              onChange={setContent}
              format={format}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function Wildcards() {
  const { addError } = useErrors()
  const { preferredLLMTarget } = useSettings()
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [wildcardToDelete, setWildcardToDelete] = useState<number | null>(null)
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [generateConcept, setGenerateConcept] = useState('')
  const [generatedName, setGeneratedName] = useState('')
  const [generatedDisplayId, setGeneratedDisplayId] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [showGenerateForm, setShowGenerateForm] = useState(false)

  const { data: wildcards, isLoading, refetch } = api.wildcards.list.useQuery()
  const { data: serverConfig } = api.config.getSettings.useQuery()

  const llmTarget = (() => {
    const targets = serverConfig?.llm?.allowedTargets
    if (!targets || targets.length === 0) return 'lm-studio'

    if (preferredLLMTarget && targets.includes(preferredLLMTarget)) {
      return preferredLLMTarget as 'lm-studio' | 'vertex' | 'openai' | 'anthropic'
    }

    return (targets.includes('vertex') ? 'vertex' : targets[0]) as 'lm-studio' | 'vertex' | 'openai' | 'anthropic'
  })()

  const createMutation = api.wildcards.create.useMutation({
    onSuccess: () => {
      refetch()
      setIsCreating(false)
    },
    onError: (error) => {
      addError(`Failed to create wildcard: ${error.message}`)
    },
  })

  const updateMutation = api.wildcards.update.useMutation({
    onSuccess: () => {
      refetch()
      setEditingId(null)
    },
    onError: (error) => {
      addError(`Failed to update wildcard: ${error.message}`)
    },
  })

  const deleteMutation = api.wildcards.delete.useMutation({
    onSuccess: () => {
      refetch()
    },
    onError: (error) => {
      addError(`Failed to delete wildcard: ${error.message}`)
    },
  })

  const generateWildcardMutation = api.llm.transform.useMutation()
  const autoLabelMutation = api.llm.transform.useMutation()

  const handleGenerateSubmit = async () => {
    if (!generateConcept.trim()) return

    try {
      // Fire both requests in parallel
      const [wildcardResult, labelResult] = await Promise.all([
        generateWildcardMutation.mutateAsync({
          text: generateConcept,
          operation: 'generate-wildcard',
          target: llmTarget,
          style: undefined,
        }),
        autoLabelMutation.mutateAsync({
          text: generateConcept,
          operation: 'auto-label',
          target: llmTarget,
          style: undefined,
        })
      ])

      // Parse the label result
      let labelTitle = 'Generated Wildcard'
      let labelCode = generateDisplayId()

      if (typeof labelResult.result === 'string') {
        try {
          const parsed = JSON.parse(labelResult.result)
          if (parsed.title) labelTitle = parsed.title
          if (parsed.code) labelCode = parsed.code
        } catch {
          // If parsing fails, use the result as-is for title
          labelTitle = labelResult.result
        }
      }

      // Format as YAML with the code-friendly key name
      if (Array.isArray(wildcardResult.result)) {
        const yamlContent = yaml.dump({ [labelCode]: wildcardResult.result })
        setGeneratedContent(yamlContent)
      }

      // Set the name and display ID
      setGeneratedName(labelTitle)
      setGeneratedDisplayId(labelCode)

      // Show the form
      setShowGenerateForm(true)
    } catch (error) {
      console.error('Generate failed:', error)
      addError('Failed to generate wildcard')
    }
  }

  const handleGenerateCreate = (values: WildcardFormValues) => {
    createMutation.mutate({
      uuid: generateUUID(),
      displayId: values.displayId,
      name: values.name,
      format: values.format,
      content: values.content,
    })
    // Reset generate state
    setIsGenerateOpen(false)
    setGenerateConcept('')
    setGeneratedName('')
    setGeneratedDisplayId('')
    setGeneratedContent('')
    setShowGenerateForm(false)
  }

  const handleCreate = (values: WildcardFormValues) => {
    createMutation.mutate({
      uuid: generateUUID(),
      displayId: values.displayId,
      name: values.name,
      format: values.format,
      content: values.content,
    })
  }

  const handleUpdate = (id: number, values: WildcardFormValues) => {
    updateMutation.mutate({
      id,
      name: values.name,
      format: values.format,
      content: values.content,
    })
  }

  const handleDelete = (id: number) => {
    setWildcardToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (wildcardToDelete !== null) {
      deleteMutation.mutate({ id: wildcardToDelete })
      setWildcardToDelete(null)
    }
  }

  return (
    <main className="container mx-auto p-8 pt-20">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="dice" size={36} />
          Wildcards
        </h1>
        <p className="text-cyan-medium">
          <mark className="highlighted-text">Manage your wildcard templates</mark>
        </p>
      </div>

      {isCreating ? (
        <div className="mb-8">
          <WildcardForm
            mode="create"
            onSubmit={handleCreate}
            onCancel={() => setIsCreating(false)}
            isSubmitting={createMutation.isPending}
          />
        </div>
      ) : (
        <div className="mb-8 flex gap-2 justify-end">
          <Button onClick={() => setIsCreating(true)}>
            Create New Wildcard
          </Button>
          <Button onClick={() => setIsGenerateOpen(true)} variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Wildcard
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-cyan-medium">
          Loading wildcards...
        </div>
      ) : wildcards && wildcards.length > 0 ? (
        <div className="space-y-4">
          {wildcards.map((wildcard, index) => (
            <motion.div
              key={wildcard.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              {editingId === wildcard.id ? (
                <WildcardForm
                  mode="edit"
                  initialValues={{
                    displayId: wildcard.displayId,
                    name: wildcard.name,
                    format: wildcard.format,
                    content: wildcard.content,
                  }}
                  onSubmit={(values) => handleUpdate(wildcard.id, values)}
                  onCancel={() => setEditingId(null)}
                  isSubmitting={updateMutation.isPending}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{wildcard.name}</CardTitle>
                        <div className="flex gap-2 mt-2 text-sm text-cyan-medium">
                          <span className="font-mono">{wildcard.displayId}</span>
                          <span>•</span>
                          <span className="capitalize">{wildcard.format}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(wildcard.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(wildcard.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-cyan-dark p-4 rounded-md text-sm font-mono overflow-x-auto whitespace-pre-wrap break-words">
                      {wildcard.content}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-cyan-medium">
              <p className="mb-4">No wildcards yet</p>
              <Button onClick={() => setIsCreating(true)}>
                Create Your First Wildcard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] h-full w-full flex flex-col">
          <DialogHeader>
            <DialogTitle>Generate New Wildcard</DialogTitle>
            <DialogDescription>
              {!showGenerateForm ? 'Enter a concept or category to generate wildcard values' : 'Review and customize your generated wildcard'}
            </DialogDescription>
          </DialogHeader>

          {!showGenerateForm ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-md space-y-4">
                <input
                  type="text"
                  value={generateConcept}
                  onChange={(e) => setGenerateConcept(e.target.value.slice(0, 140))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !generateWildcardMutation.isPending && !autoLabelMutation.isPending) {
                      handleGenerateSubmit()
                    }
                  }}
                  placeholder="Enter a category (e.g., 'emotions', 'fantasy locations')"
                  className="w-full px-4 py-2 border border-cyan-medium rounded-md focus:outline-none focus:ring-2 focus:ring-magenta-medium bg-background"
                  maxLength={140}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-cyan-medium">
                    {generateConcept.length}/140 characters
                  </span>
                  <Button
                    onClick={handleGenerateSubmit}
                    disabled={!generateConcept.trim() || generateWildcardMutation.isPending || autoLabelMutation.isPending}
                  >
                    {generateWildcardMutation.isPending || autoLabelMutation.isPending ? 'Generating...' : 'Generate'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 overflow-y-auto p-6 space-y-6"
              >
                {/* Input moved to top */}
                <div className="border-b pb-4">
                  <label className="text-sm font-medium mb-2 block">Concept</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={generateConcept}
                      onChange={(e) => setGenerateConcept(e.target.value.slice(0, 140))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !generateWildcardMutation.isPending && !autoLabelMutation.isPending) {
                          handleGenerateSubmit()
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-md border border-cyan-medium bg-background"
                      maxLength={140}
                    />
                    <Button
                      onClick={handleGenerateSubmit}
                      disabled={!generateConcept.trim() || generateWildcardMutation.isPending || autoLabelMutation.isPending}
                      variant="outline"
                    >
                      {generateWildcardMutation.isPending || autoLabelMutation.isPending ? 'Generating...' : 'Regenerate'}
                    </Button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Name</label>
                  <input
                    type="text"
                    value={generatedName}
                    onChange={(e) => setGeneratedName(e.target.value)}
                    placeholder="My Wildcard"
                    className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
                  />
                </div>

                {/* Display ID */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Display ID</label>
                  <div className="flex gap-2">
                    <DisplayIdInput
                      value={generatedDisplayId}
                      onChange={setGeneratedDisplayId}
                      placeholder="unique-id"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setGeneratedDisplayId(generateDisplayId())}
                      type="button"
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Content (YAML)</label>
                  <WildcardContentEditor
                    value={generatedContent}
                    onChange={setGeneratedContent}
                    format="yaml"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t pt-4">
                  <Button
                    onClick={() => handleGenerateCreate({
                      displayId: generatedDisplayId,
                      name: generatedName,
                      format: 'yaml',
                      content: generatedContent,
                    })}
                    disabled={!generatedDisplayId.trim() || !generatedName.trim() || !generatedContent.trim() || createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Wildcard'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsGenerateOpen(false)
                      setGenerateConcept('')
                      setGeneratedName('')
                      setGeneratedDisplayId('')
                      setGeneratedContent('')
                      setShowGenerateForm(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Wildcard"
        description="Are you sure you want to delete this wildcard? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </main>
  )
}
