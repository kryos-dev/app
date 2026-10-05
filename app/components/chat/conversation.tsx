import {
  Conversation as ConversationRoot,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { X, RotateCcw } from "lucide-react"
import { useCallback, useRef } from "react"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { MessageAssistant } from "./message-assistant"
import { MessageUser } from "./message-user"
import { isVisiblePart } from "./utils"

type QueuedMessageView = {
  id: string
  text: string
  filenames: string[]
  state: "queued" | "sending" | "failed"
}

type ConversationProps = {
  messages: ZolaUIMessage[]
  status?: "streaming" | "ready" | "submitted" | "error"
  onQuote?: (text: string, messageId: string) => void
  queuedMessages?: QueuedMessageView[]
  queuedAfter?: string
  onRemoveQueued?: (id: string) => void
  onRetryQueued?: (id: string) => void
  // Solid header cover over the list on phones. Off where the page already
  // pads for the app header, else it blanks the first message.
  topMask?: boolean
}

export function Conversation({
  messages,
  status = "ready",
  onQuote,
  queuedMessages = [],
  queuedAfter,
  onRemoveQueued,
  onRetryQueued,
  topMask = true,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length)
  const busy = status === "submitted" || status === "streaming"
  const last = messages[messages.length - 1]
  const waiting =
    busy &&
    messages.length > 0 &&
    (last.role !== "assistant" || !last.parts.some(isVisiblePart))

  // Message is memoised on the fields that drive its output and the callbacks
  // are deliberately not among them; a ref hands each Message a stable wrapper
  // that always calls the newest one.
  const onQuoteRef = useRef(onQuote)
  onQuoteRef.current = onQuote
  const stableOnQuote = useCallback(
    (text: string, messageId: string) => onQuoteRef.current?.(text, messageId),
    []
  )

  if (!messages || messages.length === 0)
    return <div className="h-full w-full"></div>

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto">
      {topMask ? (
        // Cover content as it scrolls beneath the transparent mobile header.
        // A second, fading header layer left prose half-visible behind the bar:
        // letters became gray and looked clipped mid-message. One solid layer
        // keeps the controls readable and makes covered text disappear cleanly.
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-start">
          <div className="h-app-header bg-background w-full lg:hidden" />
        </div>
      ) : null}
      <ConversationRoot className="relative w-full">
        <ConversationContent
          className="flex w-full flex-col pt-20 pb-4"
          style={{
            scrollbarGutter: "stable both-edges",
            scrollbarWidth: "none",
          }}
        >
          <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6 px-4">
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1
              // The anchor's min-height (about a screen) lets the new question
              // scroll to the top while its reply streams, and is dropped when
              // it ends so a short answer leaves no blank screen under it.
              const hasScrollAnchor =
                isLast && busy && messages.length > initialMessageCount.current

              if (message.role === "user")
                return (
                  <MessageUser
                    key={message.id}
                    id={message.id}
                    parts={message.parts}
                    hasScrollAnchor={hasScrollAnchor}
                  />
                )
              if (message.role === "assistant")
                return (
                  <MessageAssistant
                    key={message.id}
                    id={message.id}
                    parts={message.parts}
                    streaming={isLast && busy}
                    hasScrollAnchor={hasScrollAnchor}
                    onQuote={stableOnQuote}
                  />
                )
              return null
            })}
            {/* The one placeholder: a reply is pending and nothing of it is
                drawable yet. Same gutters as the assistant message, so the
                first real part replaces it in place. */}
            {waiting && (
              <div className="group min-h-scroll-anchor flex w-full min-w-0 max-w-3xl flex-col items-start gap-2 px-0 sm:px-6">
                <div className="text-muted-foreground py-1 text-sm">
                  <Shimmer as="span">Thinking…</Shimmer>
                </div>
              </div>
            )}
            {queuedMessages.length > 0 && (
              <section
                aria-label="Queued follow-up messages"
                className="border-primary/40 bg-primary/5 mx-auto w-full max-w-3xl rounded-xl border border-dashed p-3 sm:px-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-primary text-sm font-medium">
                    Next in this chat · {queuedMessages.length} queued
                  </p>
                  <span className="text-muted-foreground text-xs">
                    Sends after the current reply
                  </span>
                </div>
                {queuedAfter ? (
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    Waiting on: {queuedAfter}
                  </p>
                ) : null}
                <ol className="mt-3 space-y-2 border-l-2 border-dashed border-primary/30 pl-3">
                  {queuedMessages.map((item, index) => (
                    <li
                      key={item.id}
                      className="bg-background/80 flex min-w-0 items-start justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          {item.state === "sending"
                            ? "Sending next…"
                            : item.state === "failed"
                              ? "Couldn’t send · queued"
                              : `Queued ${index + 1}`}
                        </p>
                        {item.text.trim() ? (
                          <p className="mt-1 whitespace-pre-wrap text-sm">{item.text}</p>
                        ) : null}
                        {item.filenames.length > 0 ? (
                          <p className="text-muted-foreground mt-1 truncate text-xs">
                            Attachment{item.filenames.length === 1 ? "" : "s"}: {item.filenames.join(", ")}
                          </p>
                        ) : null}
                        {item.state === "failed" ? (
                          <button
                            type="button"
                            className="text-primary mt-1 inline-flex items-center gap-1 text-xs hover:underline"
                            onClick={() => onRetryQueued?.(item.id)}
                          >
                            <RotateCcw className="size-3" /> Retry
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove queued message ${index + 1}`}
                        disabled={item.state === "sending"}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                        onClick={() => onRemoveQueued?.(item.id)}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </ConversationContent>
        <div className="absolute bottom-0 mx-auto flex w-full max-w-3xl flex-1 items-end justify-end gap-4 px-4 pb-2">
          <ConversationScrollButton className="absolute -top-12.5 right-7.5 bottom-auto left-auto translate-x-0" />
        </div>
      </ConversationRoot>
    </div>
  )
}
