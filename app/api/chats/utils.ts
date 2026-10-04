import { db, schema } from "@/lib/db"
import { hermesMessages } from "@/lib/hermes/messages"
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

/**
 * Every message of a chat, oldest first. Rows Zola stored itself come first
 * (chats from before Hermes sessions, or the start of one whose session was
 * created later); the session transcript follows. Hermes is the only store
 * for turns that ran through a session.
 */
export async function loadChatMessages(chatId: string) {
  const [chat] = await db
    .select({ sessionId: schema.chats.hermesSessionId })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))

  // createdAt alone is not a total order (a turn's rows can share a
  // timestamp); the serial id breaks the tie.
  const local = (
    await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.chatId, chatId))
      .orderBy(asc(schema.messages.createdAt), asc(schema.messages.id))
  ).map(toMessageDTO)

  if (!chat?.sessionId) return local

  const remote = (await hermesMessages(chat.sessionId)).map((m) => {
    const content = m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("")
    return {
      id: m.id,
      chat_id: chatId,
      user_id: null,
      role: m.role,
      content,
      experimental_attachments: null,
      parts: m.parts,
      model: null,
      created_at: m.metadata?.createdAt ?? null,
    }
  })
  return [...local, ...remote]
}
