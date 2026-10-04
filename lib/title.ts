import { db, schema } from "@/lib/db"
import { cleanTitle, isPlaceholderTitle } from "@/lib/title-text"
import { eq } from "drizzle-orm"

// Hermes titles every session itself after its first turn, so the chat takes
// that title instead of paying for a second model call. The title can land a
// moment after the stream ends; one look is made per turn, and a chat still on
// its placeholder is tried again when the next turn finishes.
export async function adoptHermesTitle({
  chatId,
  sessionId,
  userText,
}: {
  chatId: string
  sessionId: string
  userText: string
}): Promise<void> {
  if (!userText.trim()) return
  // What decides this is whether the title is still a placeholder, not how many
  // rows the chat has: a reply with tool calls persists more than one.
  const [chat] = await db
    .select({ title: schema.chats.title })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))
  if (!chat || !isPlaceholderTitle(chat.title, userText)) return

  // A title is cosmetic: failing here must not matter to the caller.
  let raw: unknown
  try {
    const res = await fetch(
      `${process.env.HERMES_API_URL}/api/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${process.env.HERMES_API_KEY}` } }
    )
    if (!res.ok) throw new Error(`Hermes session read failed (${res.status})`)
    raw = ((await res.json()) as { session?: { title?: unknown } }).session?.title
  } catch (err) {
    console.warn("Title from Hermes failed:", (err as Error).message)
    return
  }
  if (typeof raw !== "string" || raw.trim() === sessionId) return
  const title = cleanTitle(raw)
  if (!title) return
  await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, chatId))
}
