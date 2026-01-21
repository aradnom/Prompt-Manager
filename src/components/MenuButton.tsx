import { motion } from 'motion/react'

interface MenuButtonProps {
  onClick: () => void
}

export function MenuButton({ onClick }: MenuButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed top-4 left-4 z-50 flex items-center justify-center group cursor-pointer"
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

      {/* Menu icon lines */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-magenta-medium group-hover:text-magenta-light transition-colors duration-300 relative z-10"
      >
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </motion.button>
  )
}
