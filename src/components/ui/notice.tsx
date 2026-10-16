import * as React from "react"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { cn } from "cn"

const styles = {
  error: { box: "border-[#ffc9c9] bg-destructive-soft text-destructive", Icon: AlertCircle },
  success: { box: "border-[#b2f2bb] bg-success-soft text-success", Icon: CheckCircle2 },
  info: { box: "border-[#ffd8a8] bg-warning-soft text-warning", Icon: Info },
}

/** Inline message for form errors and confirmations. */
function Notice({
  tone = "error",
  className,
  children,
}: {
  tone?: keyof typeof styles
  className?: string
  children: React.ReactNode
}) {
  const { box, Icon } = styles[tone]
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-xl border p-3.5 text-[15px] leading-snug", box, className)}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export { Notice }
