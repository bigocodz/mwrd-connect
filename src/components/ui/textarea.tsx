import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-sm text-[#141413] shadow-[0_0_0_1px_#f0eee6] ring-offset-[#f5f4ed] placeholder:text-[#87867f] focus-visible:border-[#3898ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3898ec] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
