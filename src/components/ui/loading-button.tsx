import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button-variants";
import { DefragLoader } from "./defrag-loader";

export interface LoadingButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loaderSize?: number;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      loaderSize = 20,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), "relative")}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        <span className={cn(loading && "invisible")}>{children}</span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              className="p-0.5 rounded-sm"
              style={{ backgroundColor: "var(--color-background)" }}
            >
              <DefragLoader size={loaderSize} />
            </span>
          </span>
        )}
      </button>
    );
  },
);
LoadingButton.displayName = "LoadingButton";

export { LoadingButton };
