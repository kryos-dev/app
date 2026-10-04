import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

/**
 * Thumbs up / thumbs down on an assistant message.
 *
 * Separate from /api/feedback, which is free-text app feedback with no message
 * attached and cannot answer "was this particular answer any good".
 */

/** A message ref is "12" (a row Zola stored) or "h345" (a Hermes transcript row). */
function messageRef(raw: unknown): string | null {
  const ref = typeof raw === "number" ? String(raw) : raw
  return typeof ref === "string" && /^h?\d+$/.test(ref) ? ref : null
}

/** Confirm the chat belongs to the caller before reading or writing its rows. */
async function ownsChat(chatId: string, userId: string) {
  const [chat] = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .limit(1)
  return Boolean(chat)
}

/** GET /api/messages/feedback?chatId=... -> { "12": 1, "h15": -1 } */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const chatId = new URL(request.url).searchParams.get("chatId")
  if (!chatId) {
    return NextResponse.json({ error: "chatId is required" }, { status: 400 })
  }
  if (!(await ownsChat(chatId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rows = await db
    .select({
      messageRef: schema.messageFeedback.messageRef,
      rating: schema.messageFeedback.rating,
    })
    .from(schema.messageFeedback)
    .where(
      and(
        eq(schema.messageFeedback.chatId, chatId),
        eq(schema.messageFeedback.userId, user.id)
      )
    )

  return NextResponse.json(
    Object.fromEntries(rows.map((r) => [r.messageRef, r.rating]))
  )
}

/**
 * POST { chatId, messageId, rating, note? }
 *
 * rating 1 or -1 sets the vote, 0 clears it. Setting is an upsert on the
 * composite key, so pressing the other thumb replaces rather than stacks.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body.chatId !== "string") {
    return NextResponse.json({ error: "chatId is required" }, { status: 400 })
  }
  const { chatId, rating, note } = body
  if (rating !== 1 && rating !== -1 && rating !== 0) {
    return NextResponse.json(
      { error: "rating must be 1, -1 or 0" },
      { status: 400 }
    )
  }
  if (!(await ownsChat(chatId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const ref = messageRef(body.messageId)
  if (ref === null) {
    return NextResponse.json({ error: "Unknown message" }, { status: 404 })
  }

  if (rating === 0) {
    await db
      .delete(schema.messageFeedback)
      .where(
        and(
          eq(schema.messageFeedback.messageRef, ref),
          eq(schema.messageFeedback.userId, user.id)
        )
      )
    return NextResponse.json({ messageId: ref, rating: 0 })
  }

  await db
    .insert(schema.messageFeedback)
    .values({
      messageRef: ref,
      chatId,
      userId: user.id,
      rating,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .onConflictDoUpdate({
      target: [schema.messageFeedback.messageRef, schema.messageFeedback.userId],
      set: {
        rating,
        note: typeof note === "string" && note.trim() ? note.trim() : null,
      },
    })

  return NextResponse.json({ messageId: ref, rating })
}
