import type { schema } from "@/lib/db"

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
    message_group_id: message.messageGroupId,
    model: message.model,
    created_at: message.createdAt,
  }
}
