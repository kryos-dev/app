import type { UserProfile } from "@/lib/user/types"
import { fetchClient } from "./fetch"

export class UsageLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_LIMIT_REACHED"
  }
}

/**
 * Single-user app: there is no guest identity to create anymore. Kept as a
 * thin shim (rather than editing every call site) so `useUser()`'s real
 * user id flows through unchanged.
 */
export const getOrCreateGuestUserId = async (
  user: UserProfile | null
): Promise<string | null> => user?.id ?? null

/**
 * Updates the model for an existing chat
 */
export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetchClient(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    })
    const responseData = await res.json()

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update chat model: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (error) {
    console.error("Error updating chat model:", error)
    throw error
  }
}
