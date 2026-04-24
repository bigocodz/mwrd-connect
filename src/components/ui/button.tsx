import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#c96442] text-[#faf9f5] shadow-[0_0_0_1px_#c96442] hover:bg-[#ad5235]",
        destructive: "bg-[#b53333] text-[#faf9f5] shadow-[0_0_0_1px_#b53333] hover:bg-[#9f2e2e]",
        outline: "bg-[#faf9f5] text-[#141413] shadow-[0_0_0_1px_#d1cfc5] hover:bg-[#e8e6dc]",
        secondary: "bg-[#e8e6dc] text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5] hover:bg-[#dedbd0]",
        ghost: "text-[#5e5d59] hover:bg-[#e8e6dc] hover:text-[#141413]",
        link: "text-[#c96442] underline-offset-4 hover:underline",
        hero: "bg-[#c96442] text-[#faf9f5] font-medium shadow-[0_0_0_1px_#c96442] hover:bg-[#ad5235]",
        "hero-outline": "bg-transparent text-[#faf9f5] shadow-[0_0_0_1px_rgba(250,249,245,0.35)] hover:bg-[#faf9f5]/10",
        nav: "bg-[#c96442] text-[#faf9f5] hover:bg-[#ad5235] font-medium",
        "nav-outline": "bg-[#faf9f5] text-[#141413] shadow-[0_0_0_1px_#d1cfc5] hover:bg-[#e8e6dc] font-medium",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
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
