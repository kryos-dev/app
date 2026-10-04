import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
} from "@/app/types/api.types"
import { db, schema } from "@/lib/db"
import { sanitizeUserInput } from "@/lib/sanitize"
import { checkUsage, incrementUsage } from "@/lib/usage"

/** Enforces usage limits. */
export async function validateAndTrackUsage({
  userId,
}: ChatApiParams): Promise<void> {
  await checkUsage(userId)
}

export async function incrementMessageCount({
  userId,
}: {
  userId: string
}): Promise<void> {
  try {
    await incrementUsage(userId)
  } catch (err) {
    console.error("Failed to increment message count:", err)
  }
}

export async function logUserMessage({
  userId,
  chatId,
  content,
  attachments,
  model,
  message_group_id,
  createdAt,
}: LogUserMessageParams): Promise<void> {
  try {
    await db.insert(schema.messages).values({
      chatId,
      role: "user",
      content: sanitizeUserInput(content),
      experimentalAttachments: attachments,
      userId,
      messageGroupId: message_group_id,
      model,
      // Explicit, so the answer can be stamped one millisecond after the
      // question instead of racing the column default (see route.ts).
      ...(createdAt ? { createdAt } : {}),
    })
  } catch (error) {
    console.error("Error saving user message:", error)
  }
}

export async function storeAssistantMessage({
  chatId,
  messages,
  message_group_id,
  model,
  createdAt,
}: StoreAssistantMessageParams & { createdAt?: Date }): Promise<boolean> {
  try {
    await saveFinalAssistantMessage(chatId, messages, message_group_id, model, createdAt)
    return true
  } catch (err) {
    console.error("Failed to save assistant messages:", err)
    return false
  }
}
