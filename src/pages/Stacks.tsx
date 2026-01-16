import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { api, RouterOutput } from '@/lib/api'
import { generateDisplayId } from '@/lib/generate-display-id'
import { generateUUID } from '@/lib/uuid'
import { useActiveStack } from '@/contexts/ActiveStackContext'

type Stack = RouterOutput['stacks']['list'][number]
import { Button } from '@/components/ui/button'
import { DisplayIdInput } from '@/components/ui/display-id-input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'

export default function Stacks() {
  const [isCreating, setIsCreating] = useState(false)
  const [displayId, setDisplayId] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [stackToDelete, setStackToDelete] = useState<number | null>(null)
  const navigate = useNavigate()
  const { setActiveStack } = useActiveStack()

  const { data: stacks, isLoading, refetch } = api.stacks.list.useQuery()
  const createMutation = api.stacks.create.useMutation({
    onSuccess: () => {
      refetch()
      setIsCreating(false)
      setDisplayId('')
    },
  })
  const deleteMutation = api.stacks.delete.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  const handleCreate = () => {
    if (!displayId.trim()) return

    createMutation.mutate({
      uuid: generateUUID(),
      displayId: displayId.trim(),
    })
  }

  const handleDelete = (id: number) => {
    setStackToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (stackToDelete !== null) {
      deleteMutation.mutate({ id: stackToDelete })
      setStackToDelete(null)
    }
  }

  const handleMakeActive = (stack: Stack) => {
    setActiveStack(stack)
    navigate('/')
  }

  return (
    <main className="container mx-auto p-8 pt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Stacks</h1>
          <p className="text-muted-foreground">
            Manage your prompt stacks
          </p>
        </div>

        {isCreating ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Stack</CardTitle>
              <CardDescription>
                Enter a memorable ID for your new stack
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
                      placeholder="e.g., summer-landscape-v1"
                      className="flex-1"
                      value={displayId}
                      onChange={setDisplayId}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate()
                        if (e.key === 'Escape') {
                          setIsCreating(false)
                          setDisplayId('')
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      variant="outline"
                      onClick={() => setDisplayId(generateDisplayId())}
                      type="button"
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false)
                      setDisplayId('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mb-8">
            <Button onClick={() => {
              setIsCreating(true)
              setDisplayId(generateDisplayId())
            }}>
              Create New Stack
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading stacks...
          </div>
        ) : stacks && stacks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stacks.map((stack, index) => (
              <motion.div
                key={stack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{stack.displayId}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {stack.uuid}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMakeActive(stack)}
                      >
                        Make Active
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(stack.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="mb-4">No stacks yet</p>
                <Button onClick={() => setIsCreating(true)}>
                  Create Your First Stack
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Stack"
          description="Are you sure you want to delete this stack? This action cannot be undone."
          confirmText="Delete"
          variant="destructive"
        />
    </main>
  )
}
