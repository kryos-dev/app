import { MessageResponse } from "@/components/ai-elements/message"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircle, RefreshCw } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"

type ChatPreviewPanelProps = {
  chatId: string | null
  onHover?: (isHovering: boolean) => void
  messages?: ChatMessage[]
  isLoading?: boolean
  error?: string | null
  onFetchPreview?: (chatId: string) => Promise<void>
}

type ChatMessage = {
  id: string
  content: string
  role: "user" | "assistant"
  created_at: string
}

type MessageBubbleProps = {
  content: string
  role: "user" | "assistant"
  timestamp: string
}

// Same renderer as the chat (Streamdown via MessageResponse), so code blocks,
// links and tables look like they do in the conversation. `wrap-anywhere`
// lowers the min-content width so a bare URL or a long unbroken string wraps
// inside the pane instead of pushing it wider than the dialog; code blocks and
// tables keep their own horizontal scroll (and `wrap-normal`, or cells split
// words into three-letter lines).
const PROSE =
  "prose prose-sm dark:prose-invert max-w-none min-w-0 wrap-anywhere [&_pre]:wrap-normal [&_table]:wrap-normal"

function MessageBubble({ content, role }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className={cn(PROSE, "bg-accent max-w-4/5 rounded-3xl px-4 py-2")}>
          <MessageResponse>{content}</MessageResponse>
        </div>
      </div>
    )
  }

  return (
    <div className={PROSE}>
      <MessageResponse>{content}</MessageResponse>
    </div>
  )
}
function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-muted-foreground flex items-center gap-2">
        <Spinner />
        <span className="text-sm">Loading messages…</span>
      </div>
    </div>
  )
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string
  onRetry?: () => void
}) {
  const isNetworkError =
    error.includes("fetch") ||
    error.includes("network") ||
    error.includes("HTTP") ||
    error.includes("Failed to fetch")

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-muted-foreground max-w-75 space-y-3 text-center">
        <div className="flex justify-center">
          <AlertCircle className="text-muted-foreground/50 h-8 w-8" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Failed to load preview</p>
          <p className="text-xs break-words opacity-70">{error}</p>
        </div>
        {isNetworkError && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-8 text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-32 items-center justify-center p-4">
      <p className="text-muted-foreground text-center text-sm">
        No messages in this conversation yet
      </p>
    </div>
  )
}

function DefaultState() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-muted-foreground space-y-2 text-center">
        <p className="text-sm opacity-60">Select a conversation to preview</p>
      </div>
    </div>
  )
}

export function ChatPreviewPanel({
  chatId,
  onHover,
  messages = [],
  isLoading = false,
  error = null,
  onFetchPreview,
}: ChatPreviewPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [lastChatId, setLastChatId] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  const shouldFetch = chatId && chatId !== lastChatId

  if (shouldFetch && onFetchPreview) {
    setLastChatId(chatId)
    setRetryCount(0)
    onFetchPreview(chatId)
  }

  const handleRetry = () => {
    if (chatId && onFetchPreview && retryCount < maxRetries) {
      setRetryCount((prev) => prev + 1)
      onFetchPreview(chatId)
    }
  }

  // Immediately scroll to bottom when chatId changes or messages load
  useLayoutEffect(() => {
    if (chatId && messages.length > 0 && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      )
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [chatId, messages.length])

  return (
    <div
      // Hidden below md: a phone has no room for a second pane.
      className="bg-background hidden min-w-0 border-l md:col-span-3 md:block"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      key={chatId}
    >
      <div className="h-140">
        {!chatId && <DefaultState />}
        {chatId && isLoading && <LoadingState />}
        {chatId && error && !isLoading && (
          <ErrorState
            error={error}
            onRetry={retryCount < maxRetries ? handleRetry : undefined}
          />
        )}
        {chatId && !isLoading && !error && messages.length === 0 && (
          <EmptyState />
        )}
        {chatId && !isLoading && !error && messages.length > 0 && (
          // Radix wraps the viewport content in a `display: table` div that
          // grows to its widest child; block keeps it at the pane width.
          <ScrollArea
            ref={scrollAreaRef}
            className="h-full [&_[data-slot=scroll-area-viewport]>div]:!block"
          >
            <div className="min-w-0 space-y-4 p-5">
              <div className="flex justify-center">
                <div className="text-muted-foreground bg-muted/50 rounded-full px-2 py-1 text-xs">
                  Last {messages.length} messages
                </div>
              </div>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  content={message.content}
                  role={message.role}
                  timestamp={message.created_at}
                />
              ))}
            </div>
            <div ref={bottomRef} />
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
