import type { Chats } from "../types"

/**
 * Fold a freshly fetched chat list into the store.
 *
 * Server data wins, with one exception: a chat the mounted view optimistically
 * marked (running on submit, complete/failed on finish or error) must not be
 * reset to "no status" by a response that arrived before the server registered
 * or settled that same turn -- the turn it shows IS real, just not visible to
 * /api/chats yet. Erasing it would flicker the sidebar dot out and, because
 * the poll only runs while some chat is running, could stop the poll that
 * would later pick the turn up.
 */
export function mergeChats(
  prev: Chats[],
  fresh: Chats[],
  optimisticIds: ReadonlySet<string>
): Chats[] {
  if (optimisticIds.size === 0) return fresh
  const prevById = new Map(prev.map((c) => [c.id, c]))
  return fresh.map((chat) => {
    if (chat.run_status) return chat
    const local = prevById.get(chat.id)
    if (local?.run_status && optimisticIds.has(chat.id)) {
      return { ...chat, run_status: local.run_status }
    }
    return chat
  })
}
