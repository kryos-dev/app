import { readFromIndexedDB, writeToIndexedDB } from "@/lib/chat-store/persist"
import type { Chat, Chats } from "@/lib/chat-store/types"
import { fetchClient } from "../../fetch"
import { API_ROUTE_CHATS } from "../../routes"

export async function getChatsForUserInDb(_userId: string): Promise<Chats[]> {
  const res = await fetchClient(API_ROUTE_CHATS)
  if (!res.ok) return []
  return res.json()
}

export async function updateChatTitleInDb(id: string, title: string) {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to update chat title")
}

export async function deleteChatInDb(id: string) {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete chat")
}

export async function getAllUserChatsInDb(userId: string): Promise<Chats[]> {
  return getChatsForUserInDb(userId)
}

export async function fetchAndCacheChats(userId: string): Promise<Chats[]> {
  const data = await getChatsForUserInDb(userId)

  if (data.length > 0) {
    await writeToIndexedDB("chats", data)
  }

  return data
}

export async function getCachedChats(): Promise<Chats[]> {
  const all = await readFromIndexedDB<Chats>("chats")
  return (all as Chats[]).sort(
    (a, b) => +new Date(b.created_at || "") - +new Date(a.created_at || "")
  )
}

export async function updateChatTitle(
  id: string,
  title: string
): Promise<void> {
  await updateChatTitleInDb(id, title)
  const all = await getCachedChats()
  const updated = (all as Chats[]).map((c) =>
    c.id === id ? { ...c, title } : c
  )
  await writeToIndexedDB("chats", updated)
}

// Move a chat into a project, or out of every project with null. Writes
// through to the cache so the sidebar's project scope is right on the next
// read rather than on the next full refresh.
export async function updateChatProject(
  id: string,
  projectId: string | null
): Promise<void> {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  })
  if (!res.ok) throw new Error("Failed to move chat")
  const all = await getCachedChats()
  await writeToIndexedDB(
    "chats",
    (all as Chats[]).map((c) => (c.id === id ? { ...c, project_id: projectId } : c))
  )
}

export async function updateChatPublic(
  id: string,
  isPublic: boolean
): Promise<void> {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public: isPublic }),
  })
  if (!res.ok) throw new Error("Failed to update sharing")
  const all = await getCachedChats()
  await writeToIndexedDB(
    "chats",
    (all as Chats[]).map((c) => (c.id === id ? { ...c, public: isPublic } : c))
  )
}

export async function deleteChat(id: string): Promise<void> {
  await deleteChatInDb(id)
  const all = await getCachedChats()
  await writeToIndexedDB(
    "chats",
    (all as Chats[]).filter((c) => c.id !== id)
  )
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const all = await readFromIndexedDB<Chat>("chats")
  return (all as Chat[]).find((c) => c.id === chatId) || null
}

export async function getUserChats(userId: string): Promise<Chat[]> {
  const data = await getAllUserChatsInDb(userId)
  if (!data) return []
  await writeToIndexedDB("chats", data)
  return data
}

export async function createChat(
  userId: string,
  title: string,
  model: string,
  _systemPrompt: string
): Promise<string> {
  const chat = await createNewChat(userId, title, model, true, undefined)
  return chat.id
}

export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetchClient(`${API_ROUTE_CHATS}/${chatId}`, {
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

    const all = await getCachedChats()
    const updated = (all as Chats[]).map((c) =>
      c.id === chatId ? { ...c, model } : c
    )
    await writeToIndexedDB("chats", updated)

    return responseData
  } catch (error) {
    console.error("Error updating chat model:", error)
    throw error
  }
}

export async function toggleChatPin(chatId: string, pinned: boolean) {
  try {
    const res = await fetchClient(`${API_ROUTE_CHATS}/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    })
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update pinned: ${res.status} ${res.statusText}`
      )
    }
    const all = await getCachedChats()
    const now = new Date().toISOString()
    const updated = (all as Chats[]).map((c) =>
      c.id === chatId ? { ...c, pinned, pinned_at: pinned ? now : null } : c
    )
    await writeToIndexedDB("chats", updated)
    return responseData
  } catch (error) {
    console.error("Error updating chat pinned:", error)
    throw error
  }
}

export async function createNewChat(
  userId: string,
  title?: string,
  model?: string,
  _isAuthenticated?: boolean,
  projectId?: string,
  id?: string
): Promise<Chats> {
  try {
    const res = await fetchClient(API_ROUTE_CHATS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title, model, projectId }),
    })

    const responseData = await res.json()

    if (!res.ok || !responseData.chat) {
      throw new Error(responseData.error || "Failed to create chat")
    }

    const chat: Chats = {
      id: responseData.chat.id,
      title: responseData.chat.title,
      created_at: responseData.chat.created_at ?? responseData.chat.createdAt,
      model: responseData.chat.model,
      user_id: responseData.chat.user_id ?? userId,
      public: responseData.chat.public,
      updated_at: responseData.chat.updated_at ?? responseData.chat.updatedAt,
      project_id: responseData.chat.project_id ?? responseData.chat.projectId ?? null,
      pinned: responseData.chat.pinned ?? false,
      pinned_at: responseData.chat.pinned_at ?? responseData.chat.pinnedAt ?? null,
    }

    await writeToIndexedDB("chats", chat)
    return chat
  } catch (error) {
    console.error("Error creating new chat:", error)
    throw error
  }
}
