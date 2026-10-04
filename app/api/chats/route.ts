import { getCurrentUser } from "@/lib/auth"
import { UsageLimitError } from "@/lib/api"
import { db, schema } from "@/lib/db"
import { checkUsage } from "@/lib/usage"
import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { toChatDTO } from "./utils"

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()

  const rows = await db
    .select()
    .from(schema.chats)
    .where(
      and(
        eq(schema.chats.userId, user.id),
        q
          ? or(
              ilike(schema.chats.title, `%${q}%`),
              sql`exists (select 1 from ${schema.messages} m where m.chat_id = ${schema.chats.id} and m.content ilike ${`%${q}%`})`
            )
          : undefined
      )
    )
    .orderBy(
      desc(schema.chats.pinned),
      desc(schema.chats.pinnedAt),
      desc(schema.chats.updatedAt)
    )

  return NextResponse.json(rows.map(toChatDTO))
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { title, model, projectId } = await request.json()

    await checkUsage(user.id)

    const [chat] = await db
      .insert(schema.chats)
      .values({
        userId: user.id,
        title: title || "New Chat",
        model,
        projectId: projectId || null,
      })
      .returning()

    return NextResponse.json({ chat: toChatDTO(chat) })
  } catch (err: unknown) {
    if (err instanceof UsageLimitError) {
      return NextResponse.json(
        { error: err.message, code: "DAILY_LIMIT_REACHED" },
        { status: 403 }
      )
    }
    console.error("Error creating chat:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
