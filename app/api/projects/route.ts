import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { asc, eq, max } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, systemPrompt, description } = await request
    .json()
    .catch(() => ({}))
  if (!name?.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 })
  }

  try {
    const [project] = await db
      .insert(schema.projects)
      .values({
        name: name.trim(),
        systemPrompt: systemPrompt?.trim() || null,
        description: description?.trim() || null,
        userId: user.id,
      })
      .returning()
    return NextResponse.json(project)
  } catch (err) {
    console.error("create project failed", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create project" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // "Updated X ago" is the latest chat's updated_at, not a column on the
  // project itself -- a project with no chats yet has none, which is what the
  // left join + null result gives for free.
  const rows = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      description: schema.projects.description,
      systemPrompt: schema.projects.systemPrompt,
      userId: schema.projects.userId,
      createdAt: schema.projects.createdAt,
      updatedAt: max(schema.chats.updatedAt),
    })
    .from(schema.projects)
    .leftJoin(schema.chats, eq(schema.chats.projectId, schema.projects.id))
    .where(eq(schema.projects.userId, user.id))
    .groupBy(
      schema.projects.id,
      schema.projects.name,
      schema.projects.description,
      schema.projects.systemPrompt,
      schema.projects.userId,
      schema.projects.createdAt
    )
    .orderBy(asc(schema.projects.createdAt))

  return NextResponse.json(rows)
}
