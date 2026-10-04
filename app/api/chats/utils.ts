import { db, schema } from "@/lib/db"
import { getRunStatus } from "@/lib/runs"
import { asc, eq } from "drizzle-orm"

/** DB rows are camelCase; the client-side store types (and the rest of the
 * UI) still expect the original Supabase snake_case shape. Map at the edge
 * rather than touching every consumer. */
export function toChatDTO(chat: typeof schema.chats.$inferSelect) {
  return {
    id: chat.id,
    user_id: chat.userId,
    project_id: chat.projectId,
    title: chat.title,
    model: chat.model,
    system_prompt: chat.systemPrompt,
    public: chat.public,
    pinned: chat.pinned,
    pinned_at: chat.pinnedAt,
    created_at: chat.createdAt,
    updated_at: chat.updatedAt,
    // The in-memory state of the chat's most recent turn (lib/runs.ts), not a
    // DB column: the sidebar dots read this. Null when no turn has run in this
    // process's lifetime.
    run_status: getRunStatus(chat.id) ?? null,
  }
}

export function toMessageDTO(message: typeof schema.messages.$inferSelect) {
  return {
    id: message.id,
    chat_id: message.chatId,
    user_id: message.userId,
    role: message.role,
    content: message.content,
    experimental_attachments: message.experimentalAttachments,
    parts: message.parts,
    model: message.model,
    created_at: message.createdAt,
  }
}

/** Every message of a chat, oldest first. */
export async function loadChatMessages(chatId: string) {
  // createdAt alone is not a total order (a turn's rows can share a
  // timestamp); the serial id breaks the tie.
  return (
    await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.chatId, chatId))
      .orderBy(asc(schema.messages.createdAt), asc(schema.messages.id))
  ).map(toMessageDTO)
}
