import * as React from "react"
import { motion } from "motion/react"
import { type VariantProps, cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { TEXT_BLOCK_ANIMATION, TEXT_BLOCK_FADE } from "@/lib/text-block-animation-settings"
import { animatedButtonVariants } from "./animated-button-variants"

const dotVariants = cva("rounded-full", {
  variants: {
    variant: {
      default: "bg-primary",
      destructive: "bg-destructive",
      outline: "bg-foreground",
      secondary: "bg-secondary",
      ghost: "bg-accent",
      link: "bg-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface AnimatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof animatedButtonVariants> {
  asChild?: boolean
  active?: boolean
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, variant, size, active = false, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(
          active ? animatedButtonVariants({ variant, size, className }) : cn(dotVariants({ variant }), "w-2 h-2 text-sm", className),
          "overflow-hidden p-0 cursor-pointer"
        )}
        animate={{
          width: active ? "auto" : "8px",
          height: active ? "auto" : "8px",
          paddingTop: active ? undefined : "0",
          paddingBottom: active ? undefined : "0",
        }}
        transition={{
          ...TEXT_BLOCK_ANIMATION,
          delay: active ? 0 : 0.1,
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(props as any)}
      >
        <motion.span
          animate={{
            opacity: active ? 1 : 0,
          }}
          transition={{
            ...TEXT_BLOCK_FADE,
            delay: active ? 0.1 : 0,
          }}
          className="inline-flex items-center gap-2 p-2"
        >
          {children}
        </motion.span>
      </motion.button>
    )
  }
)
AnimatedButton.displayName = "AnimatedButton"

export { AnimatedButton }
