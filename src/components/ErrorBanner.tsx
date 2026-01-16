import { motion, AnimatePresence } from 'motion/react'
import { useErrors } from '@/contexts/ErrorContext'
import { Button } from '@/components/ui/button'

export function ErrorBanner() {
  const { errors, removeError } = useErrors()

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 min-w-96 max-w-2xl">
      <AnimatePresence>
        {errors.map((error) => (
          <motion.div
            key={error.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="bg-destructive text-destructive-foreground px-4 py-3 rounded-md shadow-lg border border-destructive/50 flex items-start gap-3"
          >
            <div className="flex-1 text-sm">
              {error.message}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive-foreground/10"
              onClick={() => removeError(error.id)}
            >
              ×
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
