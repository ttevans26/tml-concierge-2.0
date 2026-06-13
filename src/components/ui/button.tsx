import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-quick ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-paper hover:bg-primary/90 hover:-translate-y-px hover:shadow-raised",
        destructive:
          "bg-destructive text-destructive-foreground shadow-paper hover:bg-destructive/90 hover:-translate-y-px",
        outline:
          "border border-input bg-surface-2 shadow-paper hover:border-foil hover:bg-accent/5 hover:text-foreground hover:-translate-y-px",
        secondary:
          "bg-secondary text-secondary-foreground shadow-paper hover:bg-secondary/80 hover:-translate-y-px",
        ghost: "hover:bg-accent/8 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        premium:
          "bg-foil text-accent-foreground shadow-foil border border-[hsl(36_45%_30%/0.45)] hover:-translate-y-px hover:shadow-[0_12px_28px_-8px_hsl(36_60%_35%/0.45)] [text-shadow:0_1px_0_hsl(0_0%_0%/0.18)]",
        foilOutline:
          "border border-foil-strong bg-foil-soft text-foreground shadow-paper hover:-translate-y-px hover:shadow-raised hover:border-[hsl(var(--border-foil))]",
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
