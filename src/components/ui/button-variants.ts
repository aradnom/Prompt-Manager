import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta-medium focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-magenta-medium text-foreground hover:bg-magenta-medium/80",
        secondary:
          "bg-cyan-medium text-foreground hover:bg-cyan-medium/80",
        tertiary:
          "bg-cyan-dark text-foreground hover:bg-cyan-medium/50",
        destructive:
          "bg-magenta-light text-foreground hover:bg-magenta-light/90",
        outline:
          "border border-cyan-medium bg-background hover:bg-cyan-dark hover:text-foreground",
        "outline-magenta":
          "border border-magenta-medium bg-background hover:bg-magenta-dark hover:text-foreground",
        "outline-corner-right":
          "border border-cyan-medium bg-background hover:bg-cyan-dark hover:text-foreground border-t-0 border-r-0 !rounded-none !rounded-bl-md",
        "outline-corner-left":
          "border border-cyan-medium bg-background hover:bg-cyan-dark hover:text-foreground border-t-0 border-l-0 !rounded-none !rounded-br-md",
        ghost: "hover:bg-cyan-dark hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        hero: "bg-gradient-to-r from-magenta-dark to-magenta-light/75 text-foreground hover:from-magenta-medium/90 hover:to-magenta-light/90 hover:border-2 hover:border-magenta-light text-lg font-semibold shadow-lg hover:shadow-xl",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-8 rounded-md px-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        hero: "h-16 rounded-lg px-12",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
