"use client"

import { toast } from "@/components/ui/toast"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { createContext, useContext, useEffect, useState } from "react"
import { writeToIndexedDB } from "../persist"
import {
  cacheMessages,
  clearMessagesForChat,
  getCachedMessages,
  getMessagesFromDb,
  type ZolaUIMessage,
} from "./api"

interface MessagesContextType {
  messages: ZolaUIMessage[]
  isLoading: boolean
  setMessages: React.Dispatch<React.SetStateAction<ZolaUIMessage[]>>
  refresh: () => Promise<void>
  cacheAndAddMessage: (
    message: ZolaUIMessage,
    chatIdAtSend?: string | null
  ) => Promise<void>
  resetMessages: () => Promise<void>
  deleteMessages: () => Promise<void>
}

const MessagesContext = createContext<MessagesContextType | null>(null)

export function useMessages() {
  const context = useContext(MessagesContext)
  if (!context)
    throw new Error("useMessages must be used within MessagesProvider")
  return context
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ZolaUIMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { chatId } = useChatSession()

  useEffect(() => {
    if (chatId === null) {
      setMessages([])
      setIsLoading(false)
    }
  }, [chatId])

  useEffect(() => {
    if (!chatId) return

    // Drop the previous chat's messages at once; the load below refills them.
    setMessages([])
    setIsLoading(true)

    // Every write here is guarded by `cancelled`, the way poll() already was.
    // Without it a load for the chat you just left finishes second and writes
    // ITS messages into this one provider, which the open chat then shows as
    // its own -- and sends back up on the next turn, so the server persisted
    // and titled one chat from another chat's text. The cause was one shared
    // store and one unguarded await.
    const load = async () => {
      setIsLoading(true)
      const cached = await getCachedMessages(chatId)
      if (cancelled) return
      setMessages(cached)

      try {
        const fresh = await getMessagesFromDb(chatId)
        if (cancelled) return
        setMessages(fresh)
        cacheMessages(chatId, fresh)
        // A user message with no reply yet means a run is still going on the
        // server (we left the page mid-stream); poll until the reply lands in
        // the Hermes transcript.
        if (fresh.at(-1)?.role === "user") poll()
      } catch (error) {
        if (!cancelled) console.error("Failed to fetch messages:", error)
      } finally {
        // Also guarded: a stale load clearing the flag is what made switching
        // chats look stuck rather than loading -- the spinner went away while
        // the real load was still in flight.
        if (!cancelled) setIsLoading(false)
      }
    }

    let tries = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = () => {
      if (cancelled || tries++ > 60) return
      timer = setTimeout(async () => {
        try {
          const fresh = await getMessagesFromDb(chatId)
          if (cancelled) return
          if (fresh.at(-1)?.role === "user") return poll()
          setMessages(fresh)
          cacheMessages(chatId, fresh)
        } catch {
          poll()
        }
      }, 3000)
    }

    let cancelled = false
    load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [chatId])

  const refresh = async () => {
    if (!chatId) return

    try {
      const fresh = await getMessagesFromDb(chatId)
      setMessages(fresh)
    } catch {
      toast({ title: "Failed to refresh messages", status: "error" })
    }
  }

  const cacheAndAddMessage = async (
    message: ZolaUIMessage,
    chatIdAtSend: string | null = chatId
  ) => {
    if (!chatId || chatIdAtSend !== chatId) return

    try {
      setMessages((prev) => {
        // The poll may have fetched a partial assistant row mid-turn; drop it
        // so the finished message does not show as a second bubble.
        let end = prev.length
        while (end > 0 && prev[end - 1].role === "assistant") end--
        const updated = [...prev.slice(0, end), message]
        writeToIndexedDB("messages", { id: chatId, messages: updated })
        return updated
      })
    } catch {
      toast({ title: "Failed to save message", status: "error" })
    }
  }

  const deleteMessages = async () => {
    if (!chatId) return

    setMessages([])
    await clearMessagesForChat(chatId)
  }

  const resetMessages = async () => {
    setMessages([])
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        isLoading,
        setMessages,
        refresh,
        cacheAndAddMessage,
        resetMessages,
        deleteMessages,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}
