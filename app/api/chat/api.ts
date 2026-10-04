import type { ChatApiParams } from "@/app/types/api.types"
import { checkUsage, incrementUsage } from "@/lib/usage"

/** Enforces usage limits. */
export async function validateAndTrackUsage({
  userId,
}: ChatApiParams): Promise<void> {
  await checkUsage(userId)
}

export async function incrementMessageCount({
  userId,
}: {
  userId: string
}): Promise<void> {
  try {
    await incrementUsage(userId)
  } catch (err) {
    console.error("Failed to increment message count:", err)
  }
}
