import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-4 tracking-normal transition-colors",
  {
    variants: {
      variant: {
        default: "bg-strong-950 text-white-0",
        secondary: "bg-bg-weak-50 text-sub-600 ring-1 ring-stroke-soft-200",
        outline: "bg-bg-white-0 text-sub-600 ring-1 ring-stroke-soft-200",
        success: "bg-success-lighter text-[#176c47] ring-1 ring-success-light/60",
        warning: "bg-warning-lighter text-[#8c4a18] ring-1 ring-warning-light/60",
        destructive: "bg-error-lighter text-[#a93b3b] ring-1 ring-error-light/60",
        information: "bg-information-lighter text-[#2542c2] ring-1 ring-information-light/60",
        feature: "bg-[#f2ecff] text-[#5b3bc7] ring-1 ring-feature-light/60",
        brand: "bg-primary-light text-primary-dark ring-1 ring-primary-alpha-16",
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
