import { notFound, ownsChat, requireUser } from "@/lib/auth/guards"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { hasRun } from "@/lib/runs"
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

  const rows = await loadChatMessages(id)
  // A turn is still running: the list ends on the question it answers. Any
  // rows after the last user row belong to nothing that has finished.
  const pending = hasRun(id)
  const lastUser = rows.map((m) => m.role).lastIndexOf("user")
  return NextResponse.json({
    messages: pending ? rows.slice(0, lastUser + 1) : rows,
    pending,
  })
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
