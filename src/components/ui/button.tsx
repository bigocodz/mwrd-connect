import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6d43]/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#ff6d43] text-white hover:bg-[#e85d35]",
        destructive: "bg-[#eb4f5d] text-white hover:bg-[#d9404d]",
        outline: "border border-[#e4e7ec] bg-white text-[#1d2939] hover:bg-[#f9fafb]",
        secondary: "bg-[#eaf8fb] text-[#1a1a1a] hover:bg-[#d7f0f5]",
        ghost: "text-[#667085] hover:bg-[#fff1eb] hover:text-[#1a1a1a]",
        link: "text-[#ff6d43] underline-offset-4 hover:underline",
        hero: "bg-[#ff6d43] text-white font-semibold hover:bg-[#e85d35]",
        "hero-outline": "bg-transparent text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] hover:bg-white/10",
        nav: "bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] font-semibold",
        "nav-outline": "border border-[#e4e7ec] bg-white text-[#1a1a1a] hover:bg-[#f9fafb] font-semibold",
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
