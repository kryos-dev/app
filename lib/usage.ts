import { UsageLimitError } from "@/lib/api"
import { AUTH_DAILY_MESSAGE_LIMIT } from "@/lib/config"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

// The free/pro split is gone.
//
// Upstream Zola sells a hosted plan, so it counted "pro" messages against a
// separate, smaller quota and decided what counted as pro by asking whether the
// model was on a hardcoded free list. That list was four lane ids written down
// in lib/config.ts, and every lane NOT on it -- which is every lane anyone adds
// -- silently became a pro model on a 500/day counter that nothing in the UI
// mentions. A model plane whose whole point is that lanes come and go cannot
// have a second, invisible allow-list frozen in source.
//
// There is one operator and one Hermes agent here, so every lane costs the same
// kind of money and there is nothing to upsell. One counter.

function isNewUtcDay(lastReset: Date | string | null): boolean {
  if (!lastReset) return true
  const now = new Date()
  const last = new Date(lastReset)
  return (
    now.getUTCFullYear() !== last.getUTCFullYear() ||
    now.getUTCMonth() !== last.getUTCMonth() ||
    now.getUTCDate() !== last.getUTCDate()
  )
}

/**
 * Single-user app: there's only ever one row, so every check/increment
 * operates on the current user's id.
 */
export async function checkUsage(userId: string) {
  const [userData] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))

  if (!userData) {
    throw new Error("User record not found for id: " + userId)
  }

  let dailyCount = userData.dailyMessageCount || 0

  if (isNewUtcDay(userData.dailyReset)) {
    dailyCount = 0
    await db
      .update(schema.users)
      .set({ dailyMessageCount: 0, dailyReset: new Date() })
      .where(eq(schema.users.id, userId))
  }

  if (dailyCount >= AUTH_DAILY_MESSAGE_LIMIT) {
    throw new UsageLimitError("Daily message limit reached.")
  }

  return { userData, dailyCount, dailyLimit: AUTH_DAILY_MESSAGE_LIMIT }
}

export async function incrementUsage(userId: string): Promise<void> {
  const [userData] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))

  if (!userData) throw new Error("User not found")

  await db
    .update(schema.users)
    .set({
      messageCount: (userData.messageCount || 0) + 1,
      dailyMessageCount: (userData.dailyMessageCount || 0) + 1,
    })
    .where(eq(schema.users.id, userId))
}
