import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-[0.12px] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[#30302e] text-[#faf9f5] shadow-[0_0_0_1px_#30302e]",
        secondary: "bg-[#e8e6dc] text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5]",
        destructive: "bg-[#f7e9e1] text-[#b53333] shadow-[0_0_0_1px_#eed1c5]",
        outline: "bg-[#faf9f5] text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5]",
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
