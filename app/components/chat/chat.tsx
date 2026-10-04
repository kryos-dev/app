"use client"

import { ChatView } from "@/app/components/chat/chat-view"
import { fetchChatMessages } from "@/lib/chat-store/messages/api"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useQuery } from "@tanstack/react-query"
import { redirect } from "next/navigation"
import { useState } from "react"

// One ChatSession per chat key, remounted on every switch, so nothing from the
// previous chat survives. On "/" the key is generated here and is also the id
// the chat is created under, so sending the first message and moving the URL
// to /c/<id> leaves the key, and therefore the mounted chat, unchanged.
export function Chat() {
  const { chatId } = useChatSession()
  const [draftKey, setDraftKey] = useState(() => crypto.randomUUID())
  const [lastChatId, setLastChatId] = useState(chatId)
  // Leaving a chat for "/" starts a new draft; arriving at /c/<draftKey> from
  // "/" keeps it.
  if (chatId !== lastChatId) {
    setLastChatId(chatId)
    if (chatId === null) setDraftKey(crypto.randomUUID())
  }
  const chatKey = chatId ?? draftKey
  return <ChatSession key={chatKey} chatKey={chatKey} exists={chatId !== null} />
}

function ChatSession({ chatKey, exists: existsAtMount }: { chatKey: string; exists: boolean }) {
  // Fixed for the life of this session: a draft that gets created stays a
  // draft here and is never fetched.
  const [exists] = useState(existsAtMount)

  const { data: history, isError } = useQuery({
    queryKey: ["chat-messages", chatKey],
    queryFn: () => fetchChatMessages(chatKey),
    enabled: exists,
    // Fetched once per mount and never kept: a revisit must not seed the chat
    // with an old list.
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  if (exists && history === null) return redirect("/")
  if (exists && !history && isError) {
    return <p className="text-muted-foreground m-auto text-sm">Could not load this chat.</p>
  }

  // Undefined while the history is loading; the view shows its skeleton with
  // the composer disabled and is replaced by one seeded with the rows.
  const rows = exists && !history ? undefined : (history?.messages ?? [])
  const pending = history?.pending ?? false
  return (
    <ChatView
      // Remounts when the loaded rows change (first load, or a refetch after a
      // reattach found nothing to resume), which re-seeds useChat from them.
      key={rows ? `${rows.length}:${rows.at(-1)?.id}:${pending}` : "loading"}
      chatKey={chatKey}
      exists={exists}
      history={rows}
      pending={pending}
    />
  )
}
