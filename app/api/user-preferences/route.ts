import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

function toApiShape(p: typeof schema.userPreferences.$inferSelect) {
  return {
    layout: p.layout,
    prompt_suggestions: p.promptSuggestions,
    show_tool_invocations: p.showToolInvocations,
    show_conversation_previews: p.showConversationPreviews,
    multi_model_enabled: p.multiModelEnabled,
    hidden_models: p.hiddenModels || [],
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [preferences] = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, user.id))

  if (!preferences) {
    return NextResponse.json({
      layout: "sidebar",
      prompt_suggestions: false,
      show_tool_invocations: true,
      show_conversation_previews: true,
      multi_model_enabled: false,
      hidden_models: [],
    })
  }

  return NextResponse.json(toApiShape(preferences))
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    layout,
    prompt_suggestions,
    show_tool_invocations,
    show_conversation_previews,
    multi_model_enabled,
    hidden_models,
  } = body

  if (layout && typeof layout !== "string") {
    return NextResponse.json({ error: "layout must be a string" }, { status: 400 })
  }
  if (hidden_models && !Array.isArray(hidden_models)) {
    return NextResponse.json(
      { error: "hidden_models must be an array" },
      { status: 400 }
    )
  }

  const updates: Partial<typeof schema.userPreferences.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (layout !== undefined) updates.layout = layout
  if (prompt_suggestions !== undefined) updates.promptSuggestions = prompt_suggestions
  if (show_tool_invocations !== undefined)
    updates.showToolInvocations = show_tool_invocations
  if (show_conversation_previews !== undefined)
    updates.showConversationPreviews = show_conversation_previews
  if (multi_model_enabled !== undefined) updates.multiModelEnabled = multi_model_enabled
  if (hidden_models !== undefined) updates.hiddenModels = hidden_models

  const [preferences] = await db
    .insert(schema.userPreferences)
    .values({ userId: user.id, ...updates })
    .onConflictDoUpdate({
      target: schema.userPreferences.userId,
      set: updates,
    })
    .returning()

  return NextResponse.json({ success: true, ...toApiShape(preferences) })
}
