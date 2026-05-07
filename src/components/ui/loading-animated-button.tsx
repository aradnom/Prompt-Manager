import * as React from "react";
import { motion } from "motion/react";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import {
  TEXT_BLOCK_ANIMATION,
  TEXT_BLOCK_FADE,
} from "@/lib/text-block-animation-settings";
import { animatedButtonVariants } from "./animated-button-variants";
import { DefragLoader } from "./defrag-loader";

const dotVariants = cva("rounded-full", {
  variants: {
    variant: {
      default: "bg-magenta-medium",
      destructive: "bg-magenta-light",
      outline: "bg-foreground",
      secondary: "bg-cyan-medium",
      ghost: "bg-cyan-dark",
      link: "bg-magenta-dark",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

// Loader border is always one color step brighter than the button's variant bg.
const loaderBorderVariants = cva("border-2", {
  variants: {
    variant: {
      default: "border-magenta-light",
      destructive: "border-foreground",
      outline: "border-cyan-light",
      secondary: "border-cyan-light",
      ghost: "border-cyan-medium",
      link: "border-magenta-medium",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface LoadingAnimatedButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof animatedButtonVariants> {
  asChild?: boolean;
  active?: boolean;
  loading?: boolean;
  loaderSize?: number;
  /** Render the loader (border + defrag blocks) in white. */
  whiteLoader?: boolean;
}

// Heights matching animatedButtonVariants size classes (h-10/h-9/h-11/h-10).
// We have to animate to explicit px because motion's inline style would
// otherwise override the Tailwind height class with `auto`.
const SIZE_HEIGHT_PX: Record<string, number> = {
  default: 40,
  sm: 36,
  lg: 44,
  icon: 40,
};

const LoadingAnimatedButton = React.forwardRef<
  HTMLButtonElement,
  LoadingAnimatedButtonProps
>(
  (
    {
      className,
      variant,
      size,
      active = false,
      loading = false,
      loaderSize = 12,
      whiteLoader = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const sizeKey = size ?? "default";
    const activeHeight = SIZE_HEIGHT_PX[sizeKey] ?? 40;
    const activeWidth = sizeKey === "icon" ? activeHeight : "auto";
    return (
      <motion.button
        ref={ref}
        className={cn(
          active
            ? animatedButtonVariants({ variant, size, className })
            : cn(dotVariants({ variant }), "w-2 h-2 text-sm p-0", className),
          "overflow-hidden cursor-pointer",
        )}
        animate={{
          width: active ? activeWidth : "8px",
          height: active ? activeHeight : "8px",
          paddingTop: active ? undefined : 0,
          paddingBottom: active ? undefined : 0,
          paddingLeft: active ? undefined : 0,
          paddingRight: active ? undefined : 0,
        }}
        transition={{
          ...TEXT_BLOCK_ANIMATION,
          delay: active ? 0 : 0.1,
        }}
        disabled={disabled || loading}
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
          className="inline-flex items-center gap-2 px-2.5 py-1.5 text-sm relative"
        >
          {loading ? (
            <>
              <span
                className={cn(
                  "p-0.5 rounded-sm",
                  whiteLoader
                    ? "border-2 border-foreground"
                    : loaderBorderVariants({ variant }),
                )}
                style={{ backgroundColor: "transparent" }}
              >
                <DefragLoader
                  size={loaderSize}
                  color={whiteLoader ? "var(--color-foreground)" : undefined}
                />
              </span>
              <span>Loading...</span>
            </>
          ) : (
            children
          )}
        </motion.span>
      </motion.button>
    );
  },
);
LoadingAnimatedButton.displayName = "LoadingAnimatedButton";

export { LoadingAnimatedButton };
