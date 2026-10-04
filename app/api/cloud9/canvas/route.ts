import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { and, desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

// Ownership is derived through the chat: canvases have no user_id of their
// own, so every query joins chats and checks chats.userId = user.id.
async function assertChatOwnership(chatId: string, userId: string) {
  const [chat] = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
  return Boolean(chat)
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const chatId = searchParams.get("chatId")
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 })

  if (!(await assertChatOwnership(chatId, user.id))) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  // Most-recently-updated first: with no canvasId of its own to disambiguate,
  // the client (and the chat route's upsert) treat index 0 as "the chat's canvas".
  const rows = await db
    .select()
    .from(schema.canvases)
    .where(eq(schema.canvases.chatId, chatId))
    .orderBy(desc(schema.canvases.updatedAt))

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { chatId, title, content } = body as {
    chatId?: string
    title?: string
    content?: string
  }
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 })

  if (!(await assertChatOwnership(chatId, user.id))) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  const [canvas] = await db
    .insert(schema.canvases)
    .values({
      chatId,
      title: title || "Untitled",
      content: content ?? "",
    })
    .returning()

  return NextResponse.json(canvas)
}
