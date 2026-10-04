import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { deleteHermesSession } from "@/lib/hermes/client"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { toChatDTO } from "../utils"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const [chat] = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id)))

  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  return NextResponse.json(toChatDTO(chat))
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const updates: Partial<typeof schema.chats.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (typeof body.title === "string") updates.title = body.title
  if (typeof body.model === "string") updates.model = body.model
  if (typeof body.public === "boolean") updates.public = body.public
  if (typeof body.pinned === "boolean") {
    updates.pinned = body.pinned
    updates.pinnedAt = body.pinned ? new Date() : null
  }
  // Moving a chat into a project ("Add to project", Claude's own wording).
  // The project is checked against this user: a chat must not be filed into
  // somebody else's project by passing its id.
  if (typeof body.projectId === "string" || body.projectId === null) {
    if (body.projectId) {
      const [project] = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.id, body.projectId),
            eq(schema.projects.userId, user.id)
          )
        )
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
    }
    updates.projectId = body.projectId
  }

  const [chat] = await db
    .update(schema.chats)
    .set(updates)
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id)))
    .returning()

  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  return NextResponse.json(toChatDTO(chat))
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const [deleted] = await db
    .delete(schema.chats)
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id)))
    .returning({ hermesSessionId: schema.chats.hermesSessionId })

  if (deleted?.hermesSessionId) await deleteHermesSession(deleted.hermesSessionId)

  return NextResponse.json({ success: true })
}
