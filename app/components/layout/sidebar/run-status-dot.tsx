import { cn } from "@/lib/utils"
import type { Chat } from "@/lib/chat-store/types"

const STATUS_LABEL: Record<NonNullable<Chat["run_status"]>, string> = {
  running: "Running",
  complete: "Complete",
  failed: "Failed",
}

// The response-state dot on a sidebar chat row. Same semantic colours the
// transcript already uses for tool steps: amber/pulsing while a turn runs,
// green when it completed, red when it failed. Null (no turn in this process's
// lifetime) renders nothing, so old chats stay visually quiet.
export function RunStatusDot({ status }: { status?: Chat["run_status"] }) {
  if (!status) return null
  return (
    <span
      role="img"
      aria-label={STATUS_LABEL[status]}
      title={STATUS_LABEL[status]}
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "running" && "bg-warning animate-pulse",
        status === "complete" && "bg-success",
        status === "failed" && "bg-destructive"
      )}
    />
  )
}
