import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { and, desc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

/**
 * Thumbs up / thumbs down on an assistant message.
 *
 * Separate from /api/feedback, which is free-text app feedback with no message
 * attached and cannot answer "was this particular answer any good".
 */

/**
 * Resolve the client's message id to a `messages.id`.
 *
 * Anything the browser loaded from the server carries the DB serial as a
 * string (lib/chat-store/messages/api.ts does `id: String(message.id)`), so the
 * common case is a plain parse.
 *
 * A message that has JUST streamed is the exception: the row is inserted after
 * the stream ends (app/api/chat/db.ts) and its id never travels back up the
 * SSE, so the browser is still holding the AI SDK's own generated id. Rather
 * than plumb the DB id through the stream for this one button, resolve the only
 * case that can produce a non-numeric id — it is always the newest assistant
 * message in this chat, because every older one has been through a reload and
 * therefore has a numeric id.
 */
async function resolveMessageId(
  raw: unknown,
  chatId: string
): Promise<number | null> {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw
  if (typeof raw !== "string") return null

  if (/^\d+$/.test(raw)) return Number(raw)

  const [newest] = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.chatId, chatId),
        eq(schema.messages.role, "assistant")
      )
    )
    .orderBy(desc(schema.messages.id))
    .limit(1)
  return newest?.id ?? null
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

/** GET /api/messages/feedback?chatId=... -> { "12": 1, "15": -1 } */
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

  const ids = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chatId))
  if (ids.length === 0) return NextResponse.json({})

  const rows = await db
    .select({
      messageId: schema.messageFeedback.messageId,
      rating: schema.messageFeedback.rating,
    })
    .from(schema.messageFeedback)
    .where(
      and(
        eq(schema.messageFeedback.userId, user.id),
        inArray(
          schema.messageFeedback.messageId,
          ids.map((r) => r.id)
        )
      )
    )

  return NextResponse.json(
    Object.fromEntries(rows.map((r) => [String(r.messageId), r.rating]))
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

  const messageId = await resolveMessageId(body.messageId, chatId)
  if (messageId === null) {
    return NextResponse.json({ error: "Unknown message" }, { status: 404 })
  }

  if (rating === 0) {
    await db
      .delete(schema.messageFeedback)
      .where(
        and(
          eq(schema.messageFeedback.messageId, messageId),
          eq(schema.messageFeedback.userId, user.id)
        )
      )
    return NextResponse.json({ messageId, rating: 0 })
  }

  await db
    .insert(schema.messageFeedback)
    .values({
      messageId,
      userId: user.id,
      rating,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .onConflictDoUpdate({
      target: [schema.messageFeedback.messageId, schema.messageFeedback.userId],
      set: {
        rating,
        note: typeof note === "string" && note.trim() ? note.trim() : null,
      },
    })

  return NextResponse.json({ messageId, rating })
}
