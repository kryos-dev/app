"use client"

import { formatDate } from "@/app/components/history/utils"
import { ChatInput } from "@/app/components/chat-input/chat-input"
import { Conversation } from "@/app/components/chat/conversation"
import { useChatOperations } from "@/app/components/chat/use-chat-operations"
import { useFileUpload } from "@/app/components/chat/use-file-upload"
import { useModel } from "@/app/components/chat/use-model"
import { InstructionsDialog } from "@/app/p/[projectId]/_components/instructions-dialog"
import { DialogDeleteProject } from "@/app/components/layout/sidebar/dialog-delete-project"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import { useUser } from "@/lib/user-store/provider"
import { cn } from "@/lib/utils"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type FileUIPart } from "ai"
import {
  ArrowLeftIcon,
  CaretDownIcon,
  ChatTeardropTextIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useMemo, useRef, useState } from "react"

type Project = {
  id: string
  name: string
  description: string | null
  systemPrompt: string | null
  user_id: string
  created_at: string
}

type ProjectViewProps = {
  projectId: string
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

type ProjectFile = {
  id: string
  fileName: string
  fileSize: number | null
  text: string | null
}

// The "files" part of a project: uploaded here, read into every chat's
// system prompt server-side (see lib/projects/context.ts). "not read" means
// the upload was accepted but its text was not extracted (a PDF today), not
// that anything failed.
function formatSize(bytes: number | null): string | null {
  if (!bytes && bytes !== 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ProjectFiles({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)
  const queryKey = ["projects", projectId, "files"]

  const { data: files = [], isLoading } = useQuery<ProjectFile[]>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/files`)
      if (!response.ok) throw new Error("Failed to fetch files")
      return response.json()
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: form,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Upload failed")
      }
      return response.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: Error) => toast({ title: error.message, status: "error" }),
  })

  const removeMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(
        `/api/projects/${projectId}/files?fileId=${fileId}`,
        { method: "DELETE" }
      )
      if (!response.ok) throw new Error("Failed to remove file")
      return response.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Failed to remove file", status: "error" }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Files</CardTitle>
        <CardAction>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (file) uploadMutation.mutate(file)
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Upload file"
            onClick={() => inputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            <PlusIcon size={16} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : files.length > 0 ? (
          <div className="space-y-2">
            {(expanded ? files : files.slice(0, PREVIEW_ROWS)).map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{file.fileName}</p>
                  {formatSize(file.fileSize) ? (
                    <p className="text-muted-foreground text-xs">
                      {formatSize(file.fileSize)}
                    </p>
                  ) : null}
                </div>
                {file.text === null ? (
                  <Badge variant="secondary" className="text-muted-foreground shrink-0">
                    not read
                  </Badge>
                ) : null}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${file.fileName}`}
                  onClick={() => removeMutation.mutate(file.id)}
                  disabled={removeMutation.isPending}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            ))}
            <ShowMore
              hidden={files.length - PREVIEW_ROWS}
              expanded={expanded}
              onToggle={() => setExpanded((v) => !v)}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

// Every list on this page is long and none of it is the point of the page:
// five rows, then a line that says how many are hidden. One component so the
// three lists cannot drift apart.
const PREVIEW_ROWS = 5

function ShowMore({
  hidden,
  expanded,
  onToggle,
}: {
  hidden: number
  expanded: boolean
  onToggle: () => void
}) {
  if (hidden <= 0) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground w-full justify-start"
      onClick={onToggle}
    >
      {expanded ? "Show less" : `Show ${hidden} more`}
    </Button>
  )
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enableSearch, setEnableSearch] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [chatSearch, setChatSearch] = useState("")
  const [chatsExpanded, setChatsExpanded] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { user } = useUser()
  const { createNewChat, bumpChat } = useChats()
  const { cacheAndAddMessage } = useMessages()
  const pathname = usePathname()
  const {
    files,
    setFiles,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
    handleFileUpload,
    handleFileRemove,
  } = useFileUpload()

  // Fetch project details
  const { data: project } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch project")
      }
      return response.json()
    },
  })

  // Get chats from the chat store and filter for this project
  const { chats: allChats, isLoading: chatsLoading } = useChats()

  // Filter chats for this project
  const chats = allChats.filter((chat) => chat.project_id === projectId)

  const matchingChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase()
    if (!q) return chats
    return chats.filter((chat) => (chat.title ?? "").toLowerCase().includes(q))
  }, [chats, chatSearch])
  const shownChats = chatsExpanded
    ? matchingChats
    : matchingChats.slice(0, PREVIEW_ROWS)

  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    let errorMsg = "Something went wrong."
    try {
      const parsed = JSON.parse(error.message)
      errorMsg = parsed.error || errorMsg
    } catch {
      errorMsg = error.message || errorMsg
    }
    toast({
      title: errorMsg,
      status: "error",
    })
  }, [])

  const transport = useMemo(
    () => new DefaultChatTransport({ api: API_ROUTE_CHAT }),
    []
  )

  const { messages, status, regenerate, stop, setMessages, sendMessage } =
    useChat<ZolaUIMessage>({
      // Same as use-chat-core.ts: batch paints, or every token re-parses the
      // whole reply's markdown.
      throttle: 50,
      id: `project-${projectId}-${currentChatId}`,
      messages: [],
      transport,
      onFinish: async ({ message }) => cacheAndAddMessage(message),
      onError: handleError,
    })

  const { selectedModel, handleModelChange } = useModel({
    currentChat: null,
    user,
    updateChatModel: () => Promise.resolve(),
    chatId: null,
  })

  // Simplified ensureChatExists for authenticated project context
  const ensureChatExists = useCallback(
    async (userId: string) => {
      // If we already have a current chat ID, return it
      if (currentChatId) {
        return currentChatId
      }

      // Only create a new chat if we haven't started one yet
      if (messages.length === 0) {
        try {
          const newChat = await createNewChat(
            userId,
            input,
            selectedModel,
            true, // Always authenticated in this context
            SYSTEM_PROMPT_DEFAULT,
            projectId
          )

          if (!newChat) return null

          setCurrentChatId(newChat.id)
          // Redirect to the chat page as expected
          window.history.pushState(null, "", `/c/${newChat.id}`)
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

      return currentChatId
    },
    [
      currentChatId,
      messages.length,
      createNewChat,
      input,
      selectedModel,
      projectId,
    ]
  )

  const { handleDelete, handleEdit } = useChatOperations({
    isAuthenticated: true, // Always authenticated in project context
    chatId: null,
    messages,
    selectedModel,
    systemPrompt: SYSTEM_PROMPT_DEFAULT,
    createNewChat,
    setMessages,
    setInput,
  })

  // Simple input change handler for project context (no draft saving needed)
  const handleInputChange = useCallback((value: string) => {
    setInput(value)
  }, [])

  const submit = useCallback(async () => {
    setIsSubmitting(true)

    if (!user?.id) {
      setIsSubmitting(false)
      return
    }

    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : []

    const optimisticMessage: ZolaUIMessage = {
      id: optimisticId,
      role: "user",
      parts: [textPart(input), ...attachmentsToFileParts(optimisticAttachments)],
      metadata: { createdAt: new Date().toISOString() },
    }

    setMessages((prev) => [...prev, optimisticMessage])
    const submittedInput = input
    setInput("")

    const submittedFiles = [...files]
    setFiles([])

    try {
      const currentChatIdResolved = await ensureChatExists(user.id)
      if (!currentChatIdResolved) {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      if (submittedInput.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      let attachments: Attachment[] | null = []
      if (submittedFiles.length > 0) {
        attachments = await handleFileUploads(user.id, currentChatIdResolved)
        if (attachments === null) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          cleanupOptimisticAttachments(optimisticAttachments)
          return
        }
      }

      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticAttachments)

      sendMessage(
        { text: submittedInput, files: attachmentsToFileParts(attachments) },
        {
          body: {
            chatId: currentChatIdResolved,
            userId: user.id,
            model: selectedModel,
            isAuthenticated: true,
            systemPrompt: SYSTEM_PROMPT_DEFAULT,
            enableSearch,
          },
        }
      )

      cacheAndAddMessage({
        ...optimisticMessage,
        parts: [textPart(submittedInput), ...attachmentsToFileParts(attachments)],
      })

      // Bump existing chats to top (non-blocking, after submit)
      if (messages.length > 0) {
        bumpChat(currentChatIdResolved)
      }
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticAttachments)
      toast({ title: "Failed to send message", status: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }, [
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
    sendMessage,
    cacheAndAddMessage,
    messages.length,
    bumpChat,
    enableSearch,
  ])

  const handleReload = useCallback(async () => {
    if (!user?.id) {
      return
    }

    regenerate({
      body: {
        chatId: null,
        userId: user.id,
        model: selectedModel,
        isAuthenticated: true,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
      },
    })
  }, [user, selectedModel, regenerate])

  // Memoize the conversation props to prevent unnecessary rerenders
  const conversationProps = useMemo(
    () => ({
      messages,
      status,
      onDelete: handleDelete,
      onEdit: handleEdit,
      onReload: handleReload,
    }),
    [messages, status, handleDelete, handleEdit, handleReload]
  )

  // Memoize the chat input props
  const chatInputProps = useMemo(
    () => ({
      value: input,
      onSuggestion: () => {},
      onValueChange: handleInputChange,
      onSend: submit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      hasSuggestions: false,
      onSelectModel: handleModelChange,
      selectedModel,
      isUserAuthenticated: isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
    }),
    [
      input,
      handleInputChange,
      submit,
      isSubmitting,
      files,
      handleFileUpload,
      handleFileRemove,
      handleModelChange,
      selectedModel,
      isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
    ]
  )

  // Always show onboarding when on project page, regardless of messages
  const showOnboarding = pathname === `/p/${projectId}`

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* Main column: back link, name/description, the chat itself (unchanged
          behaviour), then this project's chat list. */}
      {/* Only the desktop two-column layout scrolls per column. On mobile the
          whole page is one scroller; a nested one here clipped the chat list. */}
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-app-header md:pt-8">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href="/projects">
              <ArrowLeftIcon size={14} />
              All projects
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {project ? (
                <h1 className="truncate text-2xl font-semibold">{project.name}</h1>
              ) : (
                <Skeleton className="h-8 w-48" />
              )}
              {project?.description ? (
                <p className="text-muted-foreground text-sm">{project.description}</p>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Project actions">
                  <DotsThreeIcon size={18} weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setInstructionsOpen(true)}>
                  Edit instructions
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/projects">Rename project</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          className={cn(
            "relative flex w-full flex-col items-center overflow-x-hidden lg:min-h-0 lg:flex-1 lg:overflow-y-auto",
            showOnboarding && chats.length === 0
              ? "justify-center pt-0"
              : showOnboarding && chats.length > 0
                ? "justify-start pt-8"
                : "justify-end"
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {showOnboarding ? null : (
              <Conversation
                key="conversation"
                {...conversationProps}
                topMask={false}
              />
            )}
          </AnimatePresence>

          <motion.div
            className={cn(
              "relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl"
            )}
            layout="position"
            layoutId="chat-input-container"
            transition={{
              layout: {
                duration: messages.length === 1 ? 0.3 : 0,
              },
            }}
          >
            <ChatInput {...chatInputProps} />
          </motion.div>

          {showOnboarding ? (
            <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-muted-foreground text-sm font-medium">
                  Chats
                  {chats.length > 0 ? (
                    <span className="ml-1">· {chats.length}</span>
                  ) : null}
                </h2>
                {chats.length > PREVIEW_ROWS ? (
                  <div className="relative w-56">
                    <MagnifyingGlassIcon
                      size={14}
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
                    />
                    <Input
                      type="search"
                      aria-label="Search chats"
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      placeholder="Search chats"
                      className="h-8 pl-8"
                    />
                  </div>
                ) : null}
              </div>
              {chatsLoading ? (
                // Three rows, same height as a two-line chat row below.
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : matchingChats.length > 0 ? (
                <div>
                  {shownChats.map((chat, i) => (
                    <div key={chat.id}>
                      {i > 0 ? <Separator /> : null}
                      {/* Ghost button around the link: focus ring, hover and
                          active styles come from shadcn; flex-col + text-left
                          keep the two-line title / updated-at layout. */}
                      <Button
                        variant="ghost"
                        asChild
                        className="h-auto w-full flex-col justify-start gap-0 px-0 py-3 text-left whitespace-normal"
                      >
                        <Link href={`/c/${chat.id}`}>
                          <p className="truncate text-sm font-medium">
                            {chat.title || "Untitled Chat"}
                          </p>
                          <p className="text-muted-foreground text-xs font-normal">
                            Last message {formatDate(chat.updated_at ?? chat.created_at)}
                          </p>
                        </Link>
                      </Button>
                    </div>
                  ))}
                  <ShowMore
                    hidden={matchingChats.length - PREVIEW_ROWS}
                    expanded={chatsExpanded}
                    onToggle={() => setChatsExpanded((v) => !v)}
                  />
                </div>
              ) : chats.length === 0 ? (
                // Same empty state as the sidebar's chat list.
                <div className="text-muted-foreground flex flex-col items-center gap-1 py-12 text-center">
                  <ChatTeardropTextIcon size={24} className="opacity-40" />
                  <p className="text-sm font-medium">No chats yet</p>
                  <p className="text-13">Ask something above to start one</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No chat matches that.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right rail: instructions, files. Stacks after main on mobile
          behind a "Project details" toggle, collapsed by default so the cards
          don't push the composer off screen; its own always-open column with
          its own scroll from lg. No media-query hook: the trigger hides and
          CSS shows the content from lg regardless of open state. */}
      <Collapsible className="w-full shrink-0 border-t lg:h-full lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-l">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-4 lg:hidden [&[data-state=open]>svg]:rotate-180"
          >
            Project details
            <CaretDownIcon size={16} className="transition-transform" />
          </Button>
        </CollapsibleTrigger>
        {/* forceMount keeps the cards in the DOM while closed so lg: can show
            them without the toggle ever being opened. */}
        <CollapsibleContent
          forceMount
          className="hidden flex-col gap-4 p-4 data-[state=open]:flex lg:flex lg:pt-8"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Instructions</CardTitle>
              <CardAction>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Edit instructions"
                  onClick={() => setInstructionsOpen(true)}
                >
                  <PencilSimpleIcon size={16} />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {project ? (
                <p className="text-muted-foreground line-clamp-6 text-sm whitespace-pre-wrap">
                  {project.systemPrompt || "No instructions yet."}
                </p>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}
            </CardContent>
          </Card>

          <ProjectFiles projectId={projectId} />

        </CollapsibleContent>
      </Collapsible>

      <InstructionsDialog
        projectId={projectId}
        systemPrompt={project?.systemPrompt ?? null}
        open={instructionsOpen}
        onOpenChange={setInstructionsOpen}
      />

      {project ? (
        <DialogDeleteProject
          isOpen={deleteOpen}
          setIsOpen={setDeleteOpen}
          project={{ id: project.id, name: project.name }}
        />
      ) : null}
    </div>
  )
}
