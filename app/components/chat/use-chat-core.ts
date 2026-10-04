import { syncRecentMessages } from "@/app/components/chat/syncRecentMessages"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { useChats } from "@/lib/chat-store/chats/provider"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import type { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import {
  normalizeThinkingEffort,
  THINKING_EFFORT_DEFAULT,
  THINKING_EFFORT_STORAGE_KEY,
} from "@/lib/thinking-effort"
import type { UserProfile } from "@/lib/user/types"
import { DefaultChatTransport, type FileUIPart } from "ai"
import { useChat } from "@ai-sdk/react"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type UseChatCoreProps = {
  initialMessages: ZolaUIMessage[]
  draftValue: string
  cacheAndAddMessage: (message: ZolaUIMessage) => void
  chatId: string | null
  user: UserProfile | null
  files: File[]
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>
  setFiles: (files: File[]) => void
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void
  ensureChatExists: (uid: string, input: string) => Promise<string | null>
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>
  selectedModel: string
  clearDraft: () => void
  bumpChat: (chatId: string) => void
  /** The workspace pane's active canvas tab, if any — tells the agent which document it's editing. */
  activeCanvas?: { id: string; title: string } | null
}

function attachmentsToFileParts(attachments?: Attachment[] | null): FileUIPart[] {
  if (!attachments?.length) return []
  return attachments.map((attachment) => ({
    type: "file",
    mediaType: attachment.contentType,
    filename: attachment.name,
    url: attachment.url,
  }))
}

function textPart(text: string) {
  return { type: "text" as const, text }
}

export function useChatCore({
  initialMessages,
  draftValue,
  cacheAndAddMessage,
  chatId,
  user,
  files,
  createOptimisticAttachments,
  setFiles,
  cleanupOptimisticAttachments,
  ensureChatExists,
  handleFileUploads,
  selectedModel,
  clearDraft,
  bumpChat,
  activeCanvas,
}: UseChatCoreProps) {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false)
  // v5 useChat no longer owns input state; we manage it ourselves.
  const [input, setInput] = useState(draftValue)

  // Thinking effort; persisted across chats/sessions. Starts at the default
  // rung on both server and client, then reads localStorage after mount:
  // reading it in the initializer made the SSR markup differ (hydration).
  //
  // Normalised on the way in, because a preference saved while this picker
  // still offered "auto" or "xhigh" is a value the slider no longer has.
  const [reasoningEffort, setReasoningEffortState] = useState<string>(
    THINKING_EFFORT_DEFAULT
  )
  useEffect(() => {
    const stored = localStorage.getItem(THINKING_EFFORT_STORAGE_KEY)
    const normalized = normalizeThinkingEffort(stored)
    setReasoningEffortState(normalized)
    // Rewrite it, so the old value stops being read on every future mount.
    if (stored && stored !== normalized) {
      localStorage.setItem(THINKING_EFFORT_STORAGE_KEY, normalized)
    }
  }, [])
  const setReasoningEffort = useCallback((value: string) => {
    const normalized = normalizeThinkingEffort(value)
    setReasoningEffortState(normalized)
    if (typeof window !== "undefined") {
      localStorage.setItem(THINKING_EFFORT_STORAGE_KEY, normalized)
    }
  }, [])

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(chatId)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // Search params handling
  const searchParams = useSearchParams()
  const prompt = searchParams.get("prompt")

  // Chats operations
  const { updateTitle, refresh: refreshChats } = useChats()

  // handleReload is defined further down, and this callback must not rebuild
  // every time it changes, so the retry goes through a ref.
  const reloadRef = useRef<() => void>(() => {})

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    console.error("Chat error:", error)
    console.error("Error message:", error.message)
    let errorMsg = error.message || "Something went wrong."

    if (errorMsg === "An error occurred" || errorMsg === "fetch failed") {
      errorMsg = "Something went wrong. Please try again."
    }

    toast({
      title: errorMsg,
      status: "error",
      // A failed turn used to be a dead end: the toast said what broke and
      // left re-sending the message as the only way forward. Carry the retry
      // on the error itself.
      button: { label: "Try again", onClick: () => reloadRef.current() },
    })
  }, [])

  const transport = useMemo(
    () => new DefaultChatTransport({ api: API_ROUTE_CHAT }),
    []
  )

  // The id the useChat instance is keyed on. useChat builds a NEW Chat, and
  // stop()s the old one, whenever `id` changes. Sending the first message
  // from the home screen pushes /c/<id>, so chatId went null -> id mid-request
  // and the reply being streamed was aborted and replaced by an empty chat:
  // the "streaming text disappears" report, with the reply only reappearing
  // once the DB poll found it. The chat created by this instance keeps the
  // instance; any other navigation still swaps it.
  const creatingChatRef = useRef(false)
  const createdChatIdRef = useRef<string | null>(null)
  const chatInstanceIdRef = useRef(chatId)
  const ownsChat =
    chatInstanceIdRef.current === null &&
    (creatingChatRef.current || (chatId !== null && chatId === createdChatIdRef.current))
  if (chatId !== chatInstanceIdRef.current && !ownsChat) {
    chatInstanceIdRef.current = chatId
  }
  const chatInstanceId = chatInstanceIdRef.current

  // Initialize useChat
  const { messages, status, error, regenerate, stop: rawStop, setMessages, sendMessage } =
    useChat<ZolaUIMessage>({
      // Batch UI updates to one render per ~50ms. Without this every SSE delta
      // (Hermes sends them per token) re-renders the whole assistant message
      // and re-parses its markdown from scratch, which is the "not smooth"
      // streaming the owner reported: dozens of renders a second, each one
      // doing the full document, on a phone. 50ms is still 20 updates a
      // second -- well past what reads as continuous -- at a fraction of the
      // work. The server side is untouched: deltas still leave the box as
      // they arrive, this only changes how often React paints them.
      throttle: 50,
      // `id` keys the chat state and, with `resume`, is what the transport
      // reconnects on: it GETs `${api}/${id}/stream` on mount. Without both of
      // these an answer in flight was simply lost by navigating away -- the
      // server finished and persisted it, and the browser never found out.
      //
      // Only when there IS a chat. On the home screen useChat invents a random
      // id and `resume: true` then asked the server about a chat that does not
      // exist; the uuid column rejected the id, the route answered 500, and
      // every visit to the home page opened with "Failed to fetch the chat
      // response.".
      id: chatInstanceId ?? undefined,
      resume: !!chatInstanceId,
      messages: initialMessages,
      transport,
      onFinish: async ({ message }) => {
        cacheAndAddMessage(message)
        // The server generates the title AFTER it persists the reply, which is
        // after the stream this client was watching has already closed. So the
        // title lands some unknown moment later and nothing pushes it here.
        //
        // This used to be a single refresh at 3000ms -- a guess at how long a
        // model call takes. When the guess lost, the sidebar kept the
        // placeholder until a manual reload, which is exactly why chat titles
        // were reported as missing rather than as slow: from the outside,
        // "never appears without a reload" and "not implemented" look the same.
        //
        // A few cheap list refreshes on a widening schedule instead. Polling
        // rather than a title event on the stream because the reply is already
        // finished and closed by the time the title exists; pushing it would
        // mean keeping a stream open purely to deliver six words.
        for (const delay of [1500, 4000, 9000, 16000]) {
          setTimeout(() => void refreshChats(), delay)
        }
        try {
          const effectiveChatId =
            chatId ||
            prevChatIdRef.current ||
            (typeof window !== "undefined"
              ? localStorage.getItem("guestChatId")
              : null)

          if (!effectiveChatId) return
          await syncRecentMessages(effectiveChatId, setMessages, 2)
        } catch (error) {
          console.error("Message ID reconciliation failed: ", error)
        }
      },
      onError: handleError,
    })

  // Stop button. `rawStop()` only aborts THIS browser's fetch, and the server
  // deliberately ignores that (it keeps a tee'd copy of the stream alive so a
  // reply survives the tab closing). So Stop used to stop the UI and nothing
  // else: the model kept running on the VM, kept spending, and saved a longer
  // answer than the one on screen.
  //
  // /api/chat/abort is what actually ends the turn. Awaited, not fired and
  // forgotten, because the caller sends the next message as soon as this
  // resolves and two turns on one `X-Hermes-Session-Key` wedge the session.
  const stop = useCallback(async () => {
    rawStop()
    if (!chatId) return
    await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    }).catch(() => {})
  }, [rawStop, chatId])

  // useChat v5+ reads `messages` only once; the provider loads history
  // (cache, then DB) after mount. Push a load into the chat state only when
  // the chat changed or the chat state is still empty. Replacing on every
  // provider update dropped the optimistic user message after a reply.
  const loadedChatIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (status === "streaming" || status === "submitted") return
    // Mid-send the URL moves to /c/<new id> before submit() has claimed the
    // chat; loading that chat's (empty) history here wiped the question.
    if (creatingChatRef.current) return
    const chatChanged = loadedChatIdRef.current !== chatId
    // The provider loads the cache first (possibly stale: user turn only when
    // the user left mid-run) and the DB copy after; take any load that has
    // more messages than the live state.
    if (chatChanged || initialMessages.length > messages.length) {
      loadedChatIdRef.current = chatId
      setMessages(initialMessages)
    }
    // `status` too: a load that lands mid-stream was skipped above and,
    // without re-running once the stream settles, never applied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages, chatId, status])

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => setInput(prompt))
    }
  }, [prompt])

  // Reset messages when navigating from a chat to home (in an effect:
  // calling setMessages during render triggers React's setState-in-render
  // warning under useChat v5+).
  useEffect(() => {
    if (prevChatIdRef.current !== null && chatId === null && messages.length > 0) {
      setMessages([])
    }
    if (chatId === null) createdChatIdRef.current = null
    prevChatIdRef.current = chatId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  // Submit action. `overrideText`, when passed, sends that text instead of the
  // composer's `input` state — used by the canvas selection prompt so it can
  // submit through the normal chat pipeline without going through the textbox.
  const submit = useCallback(async (overrideText?: string) => {
    setIsSubmitting(true)
    const startedOnHome = !chatId
    if (startedOnHome) creatingChatRef.current = true

    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      setIsSubmitting(false)
      return
    }

    const textToSend = overrideText ?? input
    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : []

    const optimisticMessage: ZolaUIMessage = {
      id: optimisticId,
      role: "user",
      parts: [
        textPart(textToSend),
        ...attachmentsToFileParts(optimisticAttachments),
      ],
      metadata: { createdAt: new Date().toISOString() },
    }

    setMessages((prev) => [...prev, optimisticMessage])
    const submittedInput = textToSend
    if (!overrideText) setInput("")

    const submittedFiles = [...files]
    setFiles([])

    // A send that fails before reaching the server hands back what was typed
    // and attached, instead of silently wiping it (seen on a slow first load).
    const giveBack = () => {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticAttachments)
      if (!overrideText) setInput(submittedInput)
      setFiles(submittedFiles)
    }

    try {
      const currentChatId = await ensureChatExists(uid, submittedInput)
      // The live chat state now belongs to this chat; the history sync
      // effect must not replace it when the URL switches to /c/<id>.
      loadedChatIdRef.current = currentChatId
      if (!currentChatId) {
        giveBack()
        return
      }

      prevChatIdRef.current = currentChatId

      if (submittedInput.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        giveBack()
        return
      }

      let attachments: Attachment[] | null = []
      if (submittedFiles.length > 0) {
        attachments = await handleFileUploads(uid, currentChatId)
        if (attachments === null) {
          giveBack()
          return
        }
      }

      // Replace the optimistic message in place (messageId) rather than
      // removing it and letting sendMessage push a new one. useChat's React
      // snapshot of `messages` is throttled (50ms) but `status` is not, so the
      // remove landed first and the "submitted" render had no user message:
      // a blank chat (brand-new chat) or a vanished question (existing one).
      void sendMessage(
        {
          text: submittedInput,
          files: attachmentsToFileParts(attachments),
          messageId: optimisticId,
          metadata: optimisticMessage.metadata,
        },
        {
          body: {
            chatId: currentChatId,
            userId: uid,
            model: selectedModel,
            isAuthenticated,
            systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
            reasoningEffort,
            ...(activeCanvas
              ? { canvasId: activeCanvas.id, canvasTitle: activeCanvas.title }
              : {}),
          },
        }
      ).catch(giveBack) // only throws if the optimistic message was already gone
      cleanupOptimisticAttachments(optimisticAttachments)

      cacheAndAddMessage({
        ...optimisticMessage,
        parts: [
          textPart(submittedInput),
          ...attachmentsToFileParts(attachments),
        ],
      })
      clearDraft()

      if (messages.length > 0) {
        bumpChat(currentChatId)
      }
    } catch {
      giveBack()
      toast({ title: "Failed to send message", status: "error" })
    } finally {
      if (startedOnHome) {
        createdChatIdRef.current = prevChatIdRef.current
        creatingChatRef.current = false
      }
      setIsSubmitting(false)
    }
  }, [
    chatId,
    user,
    files,
    createOptimisticAttachments,
    input,
    setMessages,
    setFiles,
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    sendMessage,
    cacheAndAddMessage,
    clearDraft,
    messages.length,
    bumpChat,
    setIsSubmitting,
    reasoningEffort,
    activeCanvas,
  ])

  const submitEdit = useCallback(
    async (messageId: string, newContent: string) => {
      // Block edits while sending/streaming
      if (isSubmitting || status === "submitted" || status === "streaming") {
        toast({
          title: "Please wait until the current message finishes sending.",
          status: "error",
        })
        return
      }

      if (!newContent.trim()) return

      if (!chatId) {
        toast({ title: "Missing chat.", status: "error" })
        return
      }

      // Find edited message
      const editIndex = messages.findIndex(
        (m) => String(m.id) === String(messageId)
      )
      if (editIndex === -1) {
        toast({ title: "Message not found", status: "error" })
        return
      }

      const target = messages[editIndex]
      // The server deletes from this timestamp, so without it there is no edit
      // to make. It used to return silently on a console.error, which from the
      // chat looks like the Send button doing nothing at all -- say so instead.
      const cutoffIso = target?.metadata?.createdAt
      if (!cutoffIso) {
        toast({
          title: "Can't edit this message yet",
          description: "It hasn't finished saving. Try again in a moment.",
          status: "error",
        })
        return
      }

      if (newContent.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        return
      }

      // Store original messages for potential rollback
      const originalMessages = [...messages]
      const targetAttachments = target.parts.filter((p) => p.type === "file")

      const optimisticId = `optimistic-edit-${Date.now().toString()}`
      const optimisticEditedMessage: ZolaUIMessage = {
        id: optimisticId,
        role: "user",
        parts: [textPart(newContent), ...targetAttachments],
        metadata: { createdAt: new Date().toISOString() },
      }

      try {
        const trimmedMessages = messages.slice(0, editIndex)
        setMessages([...trimmedMessages, optimisticEditedMessage])

        try {
          const { writeToIndexedDB } = await import("@/lib/chat-store/persist")
          await writeToIndexedDB("messages", {
            id: chatId,
            messages: trimmedMessages,
          })
        } catch {}

        // Get user validation
        const uid = await getOrCreateGuestUserId(user)
        if (!uid) {
          setMessages(originalMessages)
          toast({ title: "Please sign in and try again.", status: "error" })
          return
        }

        const currentChatId = await ensureChatExists(uid, newContent)
        loadedChatIdRef.current = currentChatId
        if (!currentChatId) {
          setMessages(originalMessages)
          return
        }

        prevChatIdRef.current = currentChatId

        // If this is an edit of the very first user message, update chat title
        if (editIndex === 0 && target.role === "user") {
          try {
            await updateTitle(currentChatId, newContent)
          } catch {}
        }

        sendMessage(
          {
            text: newContent,
            files: targetAttachments as FileUIPart[],
          },
          {
            body: {
              chatId: currentChatId,
              userId: uid,
              model: selectedModel,
              isAuthenticated,
              systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
              reasoningEffort,
              editCutoffTimestamp: cutoffIso, // Backend will delete messages from this timestamp
            },
          }
        )

        bumpChat(currentChatId)
      } catch (error) {
        console.error("Edit failed:", error)
        setMessages(originalMessages)
        toast({ title: "Failed to apply edit", status: "error" })
      }
    },
    [
      chatId,
      messages,
      user,
      ensureChatExists,
      selectedModel,
      isAuthenticated,
      systemPrompt,
      sendMessage,
      setMessages,
      bumpChat,
      updateTitle,
      isSubmitting,
      status,
      reasoningEffort,
    ]
  )

  // Handle suggestion
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true)
      const startedOnHome = !chatId
      if (startedOnHome) creatingChatRef.current = true
      const optimisticId = `optimistic-${Date.now().toString()}`
      const optimisticMessage: ZolaUIMessage = {
        id: optimisticId,
        role: "user",
        parts: [textPart(suggestion)],
        metadata: { createdAt: new Date().toISOString() },
      }

      setMessages((prev) => [...prev, optimisticMessage])

      try {
        const uid = await getOrCreateGuestUserId(user)

        if (!uid) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          return
        }

        const currentChatId = await ensureChatExists(uid, suggestion)
        loadedChatIdRef.current = currentChatId

        if (!currentChatId) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          return
        }

        prevChatIdRef.current = currentChatId

        // In place, not remove + push: see submit().
        void sendMessage(
          { text: suggestion, messageId: optimisticId, metadata: optimisticMessage.metadata },
          {
            body: {
              chatId: currentChatId,
              userId: uid,
              model: selectedModel,
              isAuthenticated,
              // Was hardcoded to SYSTEM_PROMPT_DEFAULT, so clicking a prompt
              // suggestion silently ran with a different persona than typing
              // the same words. `systemPrompt` already resolves the user's own
              // prompt with the default as its fallback.
              systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
              reasoningEffort,
            },
          }
        ).catch(() => {})
      } catch {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        toast({ title: "Failed to send suggestion", status: "error" })
      } finally {
        if (startedOnHome) {
          createdChatIdRef.current = prevChatIdRef.current
          creatingChatRef.current = false
        }
        setIsSubmitting(false)
      }
    },
    [
      chatId,
      ensureChatExists,
      selectedModel,
      user,
      sendMessage,
      isAuthenticated,
      setMessages,
      setIsSubmitting,
      reasoningEffort,
    ]
  )

  // Handle reload
  const handleReload = useCallback(async () => {
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return
    }

    // Same body the send path builds. reasoningEffort was
    // missing here, so a retry quietly ran with search off and at the default
    // thinking rung -- a different question than the one that failed, which is
    // the worst thing a retry can be.
    regenerate({
      body: {
        chatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        reasoningEffort,
      },
    })
  }, [
    user,
    chatId,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    regenerate,
    reasoningEffort,
  ])

  // The error toast's "Try again" reaches handleReload through this.
  useEffect(() => {
    reloadRef.current = handleReload
  }, [handleReload])

  // Handle input change
  const { setDraftValue } = useChatDraft(chatId)
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      setDraftValue(value)
    },
    [setDraftValue]
  )

  return {
    // Chat state
    messages,
    input,
    status,
    error,
    stop,
    setMessages,
    setInput,
    sendMessage,
    isAuthenticated,
    systemPrompt,
    hasSentFirstMessageRef,

    // Component state
    isSubmitting,
    setIsSubmitting,
    reasoningEffort,
    setReasoningEffort,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
    submitEdit,
  }
}
