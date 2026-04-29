import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // AlignUI input: white surface, soft 1px stroke, 10px radius, primary focus ring
          "flex h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-sm leading-5 text-strong-950 shadow-[var(--shadow-regular-xs)] transition-[box-shadow,border-color] outline-none",
          "placeholder:text-soft-400",
          "hover:border-stroke-sub-300",
          "focus:border-primary-base focus:shadow-[var(--shadow-button-primary-focus)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-strong-950",
          "md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
