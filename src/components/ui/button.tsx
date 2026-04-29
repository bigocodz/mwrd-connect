import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-[background-color,color,box-shadow,transform] duration-150 ease-out",
    "focus:outline-none focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:translate-y-px",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // AlignUI primary CTA — solid carrot, focus ring 4px brand alpha
        default:
          "rounded-10 bg-primary-base text-white-0 shadow-[var(--shadow-regular-xs)] hover:bg-primary-darker active:bg-primary-dark focus-visible:shadow-[var(--shadow-button-primary-focus)]",
        destructive:
          "rounded-10 bg-error-base text-white-0 shadow-[var(--shadow-regular-xs)] hover:bg-[#e95d52] active:bg-[#d34d44] focus-visible:shadow-[var(--shadow-button-error-focus)]",
        // Neutral / secondary — white with stroke
        outline:
          "rounded-10 bg-bg-white-0 text-strong-950 ring-1 ring-stroke-soft-200 shadow-[var(--shadow-regular-xs)] hover:bg-bg-weak-50 hover:ring-stroke-sub-300 focus-visible:shadow-[var(--shadow-button-neutral-focus)]",
        secondary:
          "rounded-10 bg-bg-weak-50 text-strong-950 hover:bg-bg-soft-200 focus-visible:shadow-[var(--shadow-button-neutral-focus)]",
        ghost:
          "rounded-10 text-sub-600 hover:bg-bg-weak-50 hover:text-strong-950 focus-visible:shadow-[var(--shadow-button-neutral-focus)]",
        link:
          "h-auto p-0 text-primary-base underline-offset-4 hover:underline",
        // Landing-page variants kept for backward compatibility
        hero:
          "rounded-10 bg-primary-base px-5 py-2.5 font-semibold text-white-0 shadow-[var(--shadow-regular-xs)] hover:bg-primary-darker focus-visible:shadow-[var(--shadow-button-primary-focus)]",
        "hero-outline":
          "rounded-10 bg-transparent font-semibold text-white-0 ring-1 ring-white/40 hover:bg-white/10",
        nav:
          "rounded-10 bg-strong-950 text-white-0 font-semibold hover:bg-[#1f2330]",
        "nav-outline":
          "rounded-10 bg-bg-white-0 text-strong-950 font-semibold ring-1 ring-stroke-soft-200 hover:bg-bg-weak-50",
      },
      size: {
        default: "h-9 px-3.5 text-sm",
        xs: "h-7 px-2 text-xs rounded-8",
        sm: "h-8 px-3 text-sm rounded-8",
        lg: "h-10 px-4 text-sm rounded-10",
        xl: "h-11 px-5 text-[15px] rounded-12",
        icon: "h-9 w-9",
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
