import { getCurrentUser } from "@/lib/auth"
import { isAdminRequest } from "@/lib/auth/guards"
import { db, schema } from "@/lib/db"
import { convertFromApiFormat } from "@/lib/user-preference-store/utils"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

function toProfile(
  user: typeof schema.users.$inferSelect,
  preferences: typeof schema.userPreferences.$inferSelect | undefined,
  isAdmin: boolean
) {
  return {
    is_admin: isAdmin,
    id: user.id,
    email: user.email,
    display_name: user.displayName || "",
    profile_image: user.profileImage || "",
    favorite_models: user.favoriteModels || [],
    system_prompt: user.systemPrompt,
    message_count: user.messageCount,
    daily_message_count: user.dailyMessageCount,
    daily_reset: user.dailyReset,
    daily_pro_message_count: user.dailyProMessageCount,
    daily_pro_reset: user.dailyProReset,
    created_at: user.createdAt,
    preferences: preferences
      ? convertFromApiFormat({
          layout: preferences.layout,
          prompt_suggestions: preferences.promptSuggestions,
          show_tool_invocations: preferences.showToolInvocations,
          show_conversation_previews: preferences.showConversationPreviews,
          multi_model_enabled: preferences.multiModelEnabled,
          hidden_models: preferences.hiddenModels,
        })
      : undefined,
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [preferences] = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, user.id))

  return NextResponse.json(toProfile(user, preferences, await isAdminRequest()))
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Partial<typeof schema.users.$inferInsert> = {}
  if (typeof body.display_name === "string") updates.displayName = body.display_name
  if (typeof body.profile_image === "string") updates.profileImage = body.profile_image
  if (typeof body.system_prompt === "string") updates.systemPrompt = body.system_prompt
  if (Array.isArray(body.favorite_models)) updates.favoriteModels = body.favorite_models

  if (Object.keys(updates).length > 0) {
    await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id))
  }

  return NextResponse.json({ success: true })
}
