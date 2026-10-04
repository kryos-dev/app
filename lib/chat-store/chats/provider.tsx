"use client"

import { toast } from "@/components/ui/toast"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { MODEL_DEFAULT, SYSTEM_PROMPT_DEFAULT } from "../../config"
import type { RunStatus } from "../../runs"
import type { Chats } from "../types"
import {
  createNewChat as createNewChatFromDb,
  deleteChat as deleteChatFromDb,
  fetchAndCacheChats,
  getCachedChats,
  pollChats,
  updateChatModel as updateChatModelFromDb,
  updateChatTitle,
} from "./api"
import { mergeChats } from "./merge"

const CHATS_POLL_INTERVAL_MS = 2000

interface ChatsContextType {
  chats: Chats[]
  refresh: () => Promise<void>
  isLoading: boolean
  updateTitle: (id: string, title: string) => Promise<void>
  deleteChat: (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => Promise<void>
  setChats: React.Dispatch<React.SetStateAction<Chats[]>>
  createNewChat: (
    userId: string,
    title?: string,
    model?: string,
    isAuthenticated?: boolean,
    systemPrompt?: string,
    projectId?: string,
    id?: string
  ) => Promise<Chats | undefined>
  resetChats: () => Promise<void>
  getChatById: (id: string) => Chats | undefined
  updateChatModel: (id: string, model: string) => Promise<void>
  bumpChat: (id: string) => Promise<void>
  togglePinned: (id: string, pinned: boolean) => Promise<void>
  moveChatToProject: (id: string, projectId: string | null) => Promise<void>
  setChatPublic: (id: string, isPublic: boolean) => Promise<void>
  pinnedChats: Chats[]
  /** Optimistically set a chat's sidebar dot from the mounted view (submit /
   *  finish / error), ahead of the server's 2s status poll. */
  setChatRunStatus: (id: string, status: RunStatus) => void
}
const ChatsContext = createContext<ChatsContextType | null>(null)

export function useChats() {
  const context = useContext(ChatsContext)
  if (!context) throw new Error("useChats must be used within ChatsProvider")
  return context
}

export function ChatsProvider({
  userId,
  children,
}: {
  userId?: string
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [chats, setChats] = useState<Chats[]>([])

  // Chats the mounted view optimistically marked (running on submit, complete
  // or failed on finish/error). Their status is newer than anything the server
  // has reported yet, so the poll must not erase it; once the server confirms
  // a status the guard is dropped.
  const optimisticRunStatus = useRef(new Set<string>())

  const applyFresh = useCallback((fresh: Chats[]) => {
    for (const chat of fresh) {
      if (chat.run_status) optimisticRunStatus.current.delete(chat.id)
    }
    setChats((prev) => mergeChats(prev, fresh, optimisticRunStatus.current))
  }, [])

  const setChatRunStatus = useCallback((id: string, status: RunStatus) => {
    optimisticRunStatus.current.add(id)
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, run_status: status } : c))
    )
  }, [])

  useEffect(() => {
    if (!userId) return

    const load = async () => {
      setIsLoading(true)
      const cached = await getCachedChats()
      setChats(cached)

      try {
        const fresh = await fetchAndCacheChats(userId)
        applyFresh(fresh)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [userId, applyFresh])

  // The sidebar dots follow the server while any chat is running; with none
  // running there is nothing to poll and the interval stops. The mounted
  // view's optimistic update starts the poll the moment a turn is submitted,
  // so it covers the gap until the server reports the run itself.
  const anyChatRunning = useMemo(
    () => chats.some((c) => c.run_status === "running"),
    [chats]
  )
  useEffect(() => {
    if (!userId || !anyChatRunning) return
    const timer = setInterval(() => {
      void pollChats(userId).then((fresh) => {
        if (fresh) applyFresh(fresh)
      })
    }, CHATS_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [userId, anyChatRunning, applyFresh])

  const refresh = async () => {
    if (!userId) return

    const fresh = await fetchAndCacheChats(userId)
    applyFresh(fresh)
  }

  const updateTitle = async (id: string, title: string) => {
    let previousState: Chats[] | null = null
    setChats((prev) => {
      previousState = prev
      const updatedChatWithNewTitle = prev.map((c) =>
        c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c
      )
      return updatedChatWithNewTitle.sort(
        (a, b) => +new Date(b.updated_at || "") - +new Date(a.updated_at || "")
      )
    })
    try {
      await updateChatTitle(id, title)
    } catch {
      if (previousState) setChats(previousState)
      toast({ title: "Failed to update title", status: "error" })
    }
  }

  const deleteChat = async (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => {
    const prev = [...chats]
    setChats((prev) => prev.filter((c) => c.id !== id))

    try {
      await deleteChatFromDb(id)
      if (id === currentChatId && redirect) redirect()
    } catch {
      setChats(prev)
      toast({ title: "Failed to delete chat", status: "error" })
    }
  }

  const createNewChat = async (
    userId: string,
    title?: string,
    model?: string,
    isAuthenticated?: boolean,
    systemPrompt?: string,
    projectId?: string,
    id?: string
  ) => {
    if (!userId) return
    const prev = [...chats]

    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticChat = {
      id: optimisticId,
      title: title || "New Chat",
      created_at: new Date().toISOString(),
      model: model || MODEL_DEFAULT,
      system_prompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
      user_id: userId,
      public: true,
      updated_at: new Date().toISOString(),
      project_id: null,
      pinned: false,
      pinned_at: null,
    }
    setChats((prev) => [optimisticChat, ...prev])

    try {
      const newChat = await createNewChatFromDb(
        userId,
        title,
        model,
        isAuthenticated,
        projectId,
        id
      )

      setChats((prev) => [
        newChat,
        ...prev.filter((c) => c.id !== optimisticId),
      ])

      return newChat
    } catch {
      setChats(prev)
      toast({ title: "Failed to create chat", status: "error" })
    }
  }

  const resetChats = async () => {
    setChats([])
  }

  const getChatById = (id: string) => {
    const chat = chats.find((c) => c.id === id)
    return chat
  }

  const updateChatModel = async (id: string, model: string) => {
    const prev = [...chats]
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, model } : c)))
    try {
      await updateChatModelFromDb(id, model)
    } catch {
      setChats(prev)
      toast({ title: "Failed to update model", status: "error" })
    }
  }

  const bumpChat = async (id: string) => {
    setChats((prev) => {
      const updatedChatWithNewUpdatedAt = prev.map((c) =>
        c.id === id ? { ...c, updated_at: new Date().toISOString() } : c
      )
      return updatedChatWithNewUpdatedAt.sort(
        (a, b) => +new Date(b.updated_at || "") - +new Date(a.updated_at || "")
      )
    })
  }

  const togglePinned = async (id: string, pinned: boolean) => {
    const prevChats = [...chats]
    const now = new Date().toISOString()

    const updatedChats = prevChats.map((chat) =>
      chat.id === id
        ? { ...chat, pinned, pinned_at: pinned ? now : null }
        : chat
    )
    // Sort to maintain proper order of chats
    const sortedChats = updatedChats.sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
      return bTime - aTime
    })
    setChats(sortedChats)
    try {
      const { toggleChatPin } = await import("./api")
      await toggleChatPin(id, pinned)
    } catch {
      setChats(prevChats)
      toast({
        title: "Failed to update pin",
        status: "error",
      })
    }
  }

  const moveChatToProject = async (id: string, projectId: string | null) => {
    const prevChats = [...chats]
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, project_id: projectId } : c))
    )
    try {
      const { updateChatProject } = await import("./api")
      await updateChatProject(id, projectId)
    } catch {
      setChats(prevChats)
      toast({ title: "Failed to move chat", status: "error" })
    }
  }

  // Publishing is what makes /share/[chatId] serve a chat at all: that page
  // only reads chats with public set, so nothing leaks by holding an id.
  const setChatPublic = async (id: string, isPublic: boolean) => {
    const prevChats = [...chats]
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, public: isPublic } : c))
    )
    try {
      const { updateChatPublic } = await import("./api")
      await updateChatPublic(id, isPublic)
    } catch {
      setChats(prevChats)
      toast({ title: "Failed to update sharing", status: "error" })
    }
  }

  const pinnedChats = useMemo(
    () =>
      chats
        .filter((c) => c.pinned && !c.project_id)
        .slice()
        .sort((a, b) => {
          const at = a.pinned_at ? +new Date(a.pinned_at) : 0
          const bt = b.pinned_at ? +new Date(b.pinned_at) : 0
          return bt - at
        }),
    [chats]
  )

  return (
    <ChatsContext.Provider
      value={{
        chats,
        refresh,
        updateTitle,
        deleteChat,
        setChats,
        createNewChat,
        resetChats,
        getChatById,
        updateChatModel,
        bumpChat,
        isLoading,
        togglePinned,
        moveChatToProject,
        setChatPublic,
        pinnedChats,
        setChatRunStatus,
      }}
    >
      {children}
    </ChatsContext.Provider>
  )
}
