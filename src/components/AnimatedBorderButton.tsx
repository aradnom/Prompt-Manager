import { motion } from 'motion/react'
import { ReactNode } from 'react'

interface AnimatedBorderButtonProps {
  onClick: () => void
  position: 'left' | 'right'
  children: ReactNode
}

export function AnimatedBorderButton({ onClick, position, children }: AnimatedBorderButtonProps) {
  const positionClass = position === 'left' ? 'left-4' : 'right-4'

  return (
    <motion.button
      onClick={onClick}
      className={`fixed top-4 ${positionClass} z-50 flex items-center justify-center group cursor-pointer`}
      style={{ width: '50px', height: '50px' }}
      whileHover="hover"
      initial="initial"
    >
      {/* Animated circular border using scale instead of border-width for smooth animation */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-magenta-dark"
        variants={{
          initial: { scale: 0, opacity: 0 },
          hover: { scale: 1, opacity: 1 },
        }}
        transition={{ duration: 0.3, ease: 'anticipate' }}
      />

      {/* Icon content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.button>
  )
}
