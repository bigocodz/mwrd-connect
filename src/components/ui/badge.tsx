import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-normal transition-colors focus:outline-none focus:ring-2 focus:ring-[#2bb6c8] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[#1a1a1a] text-white shadow-[0_0_0_1px_#1a1a1a]",
        secondary: "bg-[#c6e4ee] text-[#1a1a1a] shadow-[0_0_0_1px_rgba(117,218,234,0.45)]",
        destructive: "bg-[#ffe9ec] text-[#b91f2e] shadow-[0_0_0_1px_rgba(235,79,93,0.22)]",
        outline: "bg-white text-[#42423f] shadow-[0_0_0_1px_rgba(190,184,174,0.68)]",
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
