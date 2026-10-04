import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { favorite_models } = await request.json()

  if (!Array.isArray(favorite_models)) {
    return NextResponse.json(
      { error: "favorite_models must be an array" },
      { status: 400 }
    )
  }
  if (!favorite_models.every((model) => typeof model === "string")) {
    return NextResponse.json(
      { error: "All favorite_models must be strings" },
      { status: 400 }
    )
  }

  const [updated] = await db
    .update(schema.users)
    .set({ favoriteModels: favorite_models })
    .where(eq(schema.users.id, user.id))
    .returning({ favoriteModels: schema.users.favoriteModels })

  return NextResponse.json({
    success: true,
    favorite_models: updated.favoriteModels,
  })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ favorite_models: user.favoriteModels || [] })
}
