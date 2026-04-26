import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-lg border border-[#d8d1c8] bg-white px-3 py-2 text-sm text-[#1a1a1a] shadow-[inset_0_1px_0_rgba(26,26,26,0.02)] ring-offset-[#f7f8f7] placeholder:text-[#8a8a85] focus-visible:border-[#2bb6c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2bb6c8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
