import { notFound, ownsChat, requireUser } from "@/lib/auth/guards"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { loadChatMessages } from "../../utils"

// A chat id is a UUID, not a secret: every verb here has to prove the chat
// belongs to the person asking before it touches a message, or one account
// can read and wipe another's conversation.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireUser()
  if (!user) return response

  const { id } = await params
  if (!(await ownsChat(id, user.id))) return notFound("Chat not found")

  return NextResponse.json(await loadChatMessages(id))
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
