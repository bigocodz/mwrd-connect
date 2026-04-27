import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-lg border border-[#e4e7ec] bg-white px-3 py-2 text-sm text-[#1d2939] shadow-none ring-offset-[#f5f6f8] transition-colors placeholder:text-[#98a2b3] hover:border-[#d0d5dd] focus-visible:border-[#ff6d43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6d43]/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
