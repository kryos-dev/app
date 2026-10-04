import type { UserPreferences } from "../user-preference-store/utils"

export type UserProfile = {
  id: string
  email: string
  display_name: string
  profile_image: string
  favorite_models: string[]
  system_prompt: string | null
  message_count: number | null
  daily_message_count: number | null
  daily_reset: Date | string | null
  daily_pro_message_count: number | null
  daily_pro_reset: Date | string | null
  created_at: Date | string | null
  is_admin?: boolean
  preferences?: UserPreferences
}
