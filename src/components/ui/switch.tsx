import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-[#d8d1c8] p-0.5 shadow-[inset_0_1px_2px_rgba(26,26,26,0.12)] transition-all data-[state=checked]:bg-[#ff6d43] data-[state=unchecked]:bg-[#d8d1c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2bb6c8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f7] disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[22px] w-[22px] rounded-full bg-white shadow-[0_4px_10px_rgba(26,26,26,0.24)] ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-5",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
