import { motion } from 'motion/react'
import { useActiveStack } from '@/contexts/ActiveStackContext'
import { StackContentProvider } from '@/contexts/StackContentContext'
import { StackOutputProvider, useStackOutput } from '@/contexts/StackOutputContext'
import { StackEditor } from '@/components/StackEditor'
import { StackOutputBlock } from '@/components/StackOutputBlock'

function HomeContent() {
  const { activeStack } = useActiveStack()
  const { isMinimized } = useStackOutput()

  return (
    <main className="container mx-auto p-8 pt-20 pb-96">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2">Prompt Manager</h1>
          <p className="text-cyan-medium mb-8">
            Manage your diffusion model prompts with ease
          </p>
        </motion.div>

        {activeStack && (
          <StackContentProvider>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8 rounded-lg ring-2 ring-cyan-dark accent-border-gradient"
            >
              <StackEditor stack={activeStack} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`sticky bottom-0 left-0 right-0 z-40 pb-8 ${isMinimized ? 'float-right' : ''}`}
            >
              <div className="container mx-auto">
                <StackOutputBlock />
              </div>
            </motion.div>
          </StackContentProvider>
        )}
    </main>
  )
}

export default function Home() {
  return (
    <StackOutputProvider>
      <HomeContent />
    </StackOutputProvider>
  )
}
