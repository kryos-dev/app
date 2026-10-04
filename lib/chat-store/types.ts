import type { Tables } from "@/app/types/database.types"
import type { RunStatus } from "@/lib/runs"

// The /api/chats DTOs carry the live state of each chat's most recent turn
// (lib/runs.ts) as `run_status`; it is not a DB column. Optional so rows cached
// in IndexedDB before the field existed still typecheck.
export type Chat = Tables<"chats"> & { run_status?: RunStatus | null }
export type Message = Tables<"messages">
export type Chats = Tables<"chats"> & { run_status?: RunStatus | null }
