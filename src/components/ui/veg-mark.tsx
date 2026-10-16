import { cn } from "cn"

/** The FSSAI-style square-and-dot food mark: green for veg, red for non-veg. */
function VegMark({ isVeg, className }: { isVeg: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={isVeg ? "Veg" : "Non-veg"}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px]",
        isVeg ? "border-veg" : "border-nonveg",
        className
      )}
    >
      <span className={cn("size-2 rounded-full", isVeg ? "bg-veg" : "bg-nonveg")} />
    </span>
  )
}

export { VegMark }
