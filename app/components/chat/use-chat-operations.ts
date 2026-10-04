import { toast } from "@/components/ui/toast"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import type { Chats } from "@/lib/chat-store/types"
import { useCallback } from "react"

type UseChatOperationsProps = {
  isAuthenticated: boolean
  chatId: string | null
  messages: ZolaUIMessage[]
  selectedModel: string
  systemPrompt: string
  createNewChat: (
    userId: string,
    title?: string,
    model?: string,
    isAuthenticated?: boolean,
    systemPrompt?: string
  ) => Promise<Chats | undefined>
  setMessages: (
    messages: ZolaUIMessage[] | ((messages: ZolaUIMessage[]) => ZolaUIMessage[])
  ) => void
  setInput: (input: string) => void
}

export function useChatOperations({
  isAuthenticated,
  chatId,
  messages,
  selectedModel,
  systemPrompt,
  createNewChat,
  setMessages,
}: UseChatOperationsProps) {
  const ensureChatExists = async (userId: string, input: string) => {
    if (chatId) return chatId

    if (!isAuthenticated) {
      const storedGuestChatId = localStorage.getItem("guestChatId")
      if (storedGuestChatId) return storedGuestChatId
    }

    try {
      const newChat = await createNewChat(
        userId,
        input,
        selectedModel,
        isAuthenticated,
        systemPrompt
      )

      if (!newChat) return null
      if (isAuthenticated) {
        window.history.pushState(null, "", `/c/${newChat.id}`)
      } else {
        localStorage.setItem("guestChatId", newChat.id)
      }

      return newChat.id
    } catch (err: unknown) {
      let errorMessage = "Something went wrong."
      try {
        const errorObj = err as { message?: string }
        if (errorObj.message) {
          const parsed = JSON.parse(errorObj.message)
          errorMessage = parsed.error || errorMessage
        }
      } catch {
        const errorObj = err as { message?: string }
        errorMessage = errorObj.message || errorMessage
      }
      toast({
        title: errorMessage,
        status: "error",
      })
      return null
    }
  }

  // Message handlers
  const handleDelete = useCallback(
    (id: string) => {
      setMessages(messages.filter((message) => message.id !== id))
    },
    [messages, setMessages]
  )

  const handleEdit = useCallback(
    (id: string, newText: string) => {
      setMessages(
        messages.map((message) =>
          message.id === id
            ? {
                ...message,
                parts: [{ type: "text" as const, text: newText }],
              }
            : message
        )
      )
    },
    [messages, setMessages]
  )

  return {
    // Utils
    ensureChatExists,

    // Handlers
    handleDelete,
    handleEdit,
  }
}
