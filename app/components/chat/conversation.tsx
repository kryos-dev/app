import {
  Conversation as ConversationRoot,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { useCallback, useRef } from "react"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { MessageAssistant } from "./message-assistant"
import { MessageUser } from "./message-user"
import { isVisiblePart } from "./utils"

type ConversationProps = {
  messages: ZolaUIMessage[]
  status?: "streaming" | "ready" | "submitted" | "error"
  onQuote?: (text: string, messageId: string) => void
  // Header-height fade over the top of the list on phones. Off where the page
  // already pads for the app header, else it blanks the first message.
  topMask?: boolean
}

export function Conversation({
  messages,
  status = "ready",
  onQuote,
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
          </div>
        </ConversationContent>
        <div className="absolute bottom-0 mx-auto flex w-full max-w-3xl flex-1 items-end justify-end gap-4 px-4 pb-2">
          <ConversationScrollButton className="absolute -top-12.5 right-7.5 bottom-auto left-auto translate-x-0" />
        </div>
      </ConversationRoot>
    </div>
  )
}
