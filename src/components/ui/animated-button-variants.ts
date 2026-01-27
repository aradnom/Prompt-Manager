import { cva } from "class-variance-authority";

export const animatedButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta-medium focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-magenta-dark text-foreground hover:bg-magenta-dark/90",
        destructive:
          "bg-magenta-light text-foreground hover:bg-magenta-light/90",
        outline:
          "border border-cyan-medium bg-background hover:bg-cyan-dark hover:text-foreground",
        secondary: "bg-cyan-medium text-foreground hover:bg-cyan-medium/80",
        ghost: "hover:bg-cyan-dark hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
