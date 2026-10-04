import { cn } from "@/lib/utils"

// success marks "running/ok"; destructive marks error; muted is everything else.
export function StatusDot({
  status,
  className,
}: {
  status: "ok" | "error" | "muted"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        status === "ok" && "bg-success",
        status === "error" && "bg-destructive",
        status === "muted" && "bg-muted-foreground/40",
        className
      )}
    />
  )
}
