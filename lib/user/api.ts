import { getCurrentUser } from "@/lib/auth"
import { isAdminRequest } from "@/lib/auth/guards"
import { db, schema } from "@/lib/db"
import {
  convertFromApiFormat,
} from "@/lib/user-preference-store/utils"
import { eq } from "drizzle-orm"
import type { UserProfile } from "./types"

export async function getUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const [preferences] = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, user.id))

  return {
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
    // The operator flag the access service sets, so the UI can leave out what
    // the API would refuse anyway. It is a display hint, never the check.
    is_admin: await isAdminRequest(),
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
