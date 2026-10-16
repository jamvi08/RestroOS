import * as React from "react"
import { cn } from "cn"

/** 10-digit Indian mobile number field with a fixed +91 prefix. */
function PhoneInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div
      className={cn(
        "flex h-12 w-full overflow-hidden rounded-xl border-[1.5px] border-input bg-card transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15",
        className
      )}
    >
      <span className="flex items-center border-r border-input bg-muted px-4 text-base font-semibold text-foreground">
        +91
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        className="min-w-0 flex-1 bg-transparent px-4 text-lg font-medium tracking-wide text-foreground outline-none placeholder:font-normal placeholder:text-[#868e96]"
        {...props}
      />
    </div>
  )
}

export { PhoneInput }
