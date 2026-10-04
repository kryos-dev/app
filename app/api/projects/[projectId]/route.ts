import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)))

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  return NextResponse.json(project)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const { name, systemPrompt, description } = await request.json()

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 })
  }
  if (
    name === undefined &&
    systemPrompt === undefined &&
    description === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only what was sent: renaming a project must not wipe its instructions, and
  // editing its instructions must not need the name sent back.
  const [project] = await db
    .update(schema.projects)
    .set({
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(systemPrompt !== undefined ? { systemPrompt: systemPrompt?.trim() || null } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
    })
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)))
    .returning()

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  return NextResponse.json(project)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)))

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)))

  return NextResponse.json({ success: true })
}
