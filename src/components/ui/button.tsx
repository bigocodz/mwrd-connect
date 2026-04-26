import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2bb6c8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#ff6d43] text-white shadow-[0_1px_0_rgba(26,26,26,0.18),0_10px_22px_rgba(255,109,67,0.18)] hover:bg-[#e85d35]",
        destructive: "bg-[#eb4f5d] text-white shadow-[0_1px_0_rgba(26,26,26,0.18)] hover:bg-[#d9404d]",
        outline: "bg-white text-[#1a1a1a] shadow-[inset_0_0_0_1px_rgba(190,184,174,0.72)] hover:bg-[#f7f8f7]",
        secondary: "bg-[#c6e4ee] text-[#1a1a1a] shadow-[inset_0_0_0_1px_rgba(117,218,234,0.45)] hover:bg-[#b7dce8]",
        ghost: "text-[#5f625f] hover:bg-[#eef5f6] hover:text-[#1a1a1a]",
        link: "text-[#ff6d43] underline-offset-4 hover:underline",
        hero: "bg-[#ff6d43] text-white font-semibold shadow-[0_14px_34px_rgba(255,109,67,0.28)] hover:bg-[#e85d35]",
        "hero-outline": "bg-transparent text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] hover:bg-white/10",
        nav: "bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] font-semibold",
        "nav-outline": "bg-white text-[#1a1a1a] shadow-[inset_0_0_0_1px_rgba(190,184,174,0.72)] hover:bg-[#f7f8f7] font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 px-5",
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
