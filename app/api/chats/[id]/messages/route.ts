import { notFound, ownsChat, requireUser } from "@/lib/auth/guards"
import { db, schema } from "@/lib/db"
import { asc, desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { toMessageDTO } from "../../utils"

// A chat id is a UUID, not a secret: every verb here has to prove the chat
// belongs to the person asking before it touches a message, or one account
// can read, append to and wipe another's conversation.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireUser()
  if (!user) return response

  const { id } = await params
  if (!(await ownsChat(id, user.id))) return notFound("Chat not found")

  // `?limit=N` returns the LAST n messages, still oldest-first.
  //
  // The caller that needs two of them ran after every single turn and fetched
  // the whole conversation to slice the tail off it in JavaScript, so a long
  // chat got slower with every reply it received. Unbounded stays the default
  // because opening a chat legitimately wants all of it.
  const limitParam = Number(new URL(request.url).searchParams.get("limit"))
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : 0

  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.chatId, id))
    // createdAt alone is not a total order. It defaults to now() inside the
    // transaction that writes a turn, so the question and its answer can carry
    // the SAME timestamp, and Postgres is then free to return them either way
    // round -- which is the reply rendering above the message that caused it
    //. messages.id is a serial, so insertion
    // order is available and is the real order of a conversation; it breaks
    // the tie without changing anything that was already unambiguous.
    // Descending + limit when a tail was asked for: the index is read from the
    // end and stops after n rows, instead of reading every row to discard all
    // but the last n. Reversed below so the response shape never changes.
    .orderBy(
      limit
        ? desc(schema.messages.createdAt)
        : asc(schema.messages.createdAt),
      limit ? desc(schema.messages.id) : asc(schema.messages.id)
    )
    .limit(limit || Number.MAX_SAFE_INTEGER)

  if (limit) rows.reverse()
  return NextResponse.json(rows.map(toMessageDTO))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireUser()
  if (!user) return response

  const { id } = await params
  if (!(await ownsChat(id, user.id))) return notFound("Chat not found")

  const body = await request.json()
  const messages = Array.isArray(body.messages) ? body.messages : [body]

  const rows = await db
    .insert(schema.messages)
    .values(
      messages.map(
        (m: {
          role: string
          content: string | null
          experimental_attachments?: unknown
          createdAt?: string
          message_group_id?: string
          model?: string
        }) => ({
          chatId: id,
          userId: user.id,
          role: m.role,
          content: m.content,
          experimentalAttachments: m.experimental_attachments,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          messageGroupId: m.message_group_id || null,
          model: m.model || null,
        })
      )
    )
    .returning()

  return NextResponse.json(rows.map(toMessageDTO))
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireUser()
  if (!user) return response

  const { id } = await params
  if (!(await ownsChat(id, user.id))) return notFound("Chat not found")

  await db.delete(schema.messages).where(eq(schema.messages.chatId, id))
  return NextResponse.json({ success: true })
}
