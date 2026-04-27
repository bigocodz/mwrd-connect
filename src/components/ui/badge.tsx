import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold tracking-normal transition-colors focus:outline-none focus:ring-2 focus:ring-[#ff6d43]/20 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[#1a1a1a] text-white",
        secondary: "bg-[#eaf8fb] text-[#1a1a1a]",
        destructive: "bg-[#ffe9ec] text-[#b91f2e]",
        outline: "border border-[#e4e7ec] bg-white text-[#344054]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
