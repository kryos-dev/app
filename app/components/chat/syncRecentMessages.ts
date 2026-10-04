import { getMessagesFromDb, type ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { writeToIndexedDB } from "@/lib/chat-store/persist"

// After a turn finishes the Hermes transcript holds the final message under its
// own stable id. Replace the live stream state with it so the two never show
// the same turn twice. A transcript that does not end with the assistant turn
// yet is left alone; the live message stays on screen.
export async function syncRecentMessages(
  chatId: string,
  setMessages: (messages: ZolaUIMessage[]) => void
): Promise<void> {
  const fresh = await getMessagesFromDb(chatId)
  if (fresh.at(-1)?.role !== "assistant") return
  setMessages(fresh)
  await writeToIndexedDB("messages", { id: chatId, messages: fresh })
}
