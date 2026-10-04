import {
  Conversation as ConversationRoot,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { useCallback, useRef } from "react"
import { Loader } from "./loader"
import { Message } from "./message"

type ConversationProps = {
  messages: ZolaUIMessage[]
  status?: "streaming" | "ready" | "submitted" | "error"
  onEdit: (id: string, newText: string) => void
  onReload: () => void
  onQuote?: (text: string, messageId: string) => void
  isUserAuthenticated?: boolean
  // Header-height fade over the top of the list on phones. Off where the page
  // already pads for the app header, else it blanks the first message.
  topMask?: boolean
}

export function Conversation({
  messages,
  status = "ready",
  onEdit,
  onReload,
  onQuote,
  isUserAuthenticated,
  topMask = true,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length)

  // Message is memoised on the fields that drive its output and the callbacks
  // are deliberately not among them: submitEdit depends on `messages`, so it
  // rebuilds on every streamed token and comparing it would re-render every
  // finished message per token. But handleReload also rebuilds when the model,
  // thinking rung, search or system prompt change, and the memo swallowed
  // that -- Regenerate ran with whatever model was chosen a switch ago. Refs
  // hand each Message a stable wrapper that always calls the newest one, the
  // way use-chat-core reaches handleReload through reloadRef.
  const onEditRef = useRef(onEdit)
  onEditRef.current = onEdit
  const onReloadRef = useRef(onReload)
  onReloadRef.current = onReload
  const onQuoteRef = useRef(onQuote)
  onQuoteRef.current = onQuote
  const stableOnEdit = useCallback(
    (id: string, text: string) => onEditRef.current(id, text),
    []
  )
  const stableOnReload = useCallback(() => onReloadRef.current(), [])
  const stableOnQuote = useCallback(
    (text: string, messageId: string) => onQuoteRef.current?.(text, messageId),
    []
  )

  if (!messages || messages.length === 0)
    return <div className="h-full w-full"></div>

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto">
      {topMask ? (
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
          <div className="h-app-header bg-background flex w-full lg:hidden lg:h-0" />
          <div className="h-app-header bg-background flex w-full mask-b-from-4% mask-b-to-100% lg:hidden" />
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
            {messages?.map((message, index) => {
              const isLast =
                index === messages.length - 1 && status !== "submitted"
              // The anchor's min-height (about a screen) lets the new question
              // scroll to the top while its reply streams. Kept after the
              // reply ended it left a screen of blank space under any short
              // answer, most visible on a phone.
              const hasScrollAnchor =
                isLast &&
                status === "streaming" &&
                messages.length > initialMessageCount.current

              return (
                <Message
                  // Index, not id: after a reply finishes, syncRecentMessages
                  // swaps the client ids for the DB ids, and an id key then
                  // remounted both messages (markdown re-rendered from
                  // scratch, canvas cards lost their state) -- a visible
                  // flash as the stream ended. The list only ever appends
                  // or truncates, so position is a stable identity.
                  key={index}
                  id={message.id}
                  variant={message.role}
                  parts={message.parts}
                  isLast={isLast}
                  onEdit={stableOnEdit}
                  onReload={stableOnReload}
                  hasScrollAnchor={hasScrollAnchor}
                  status={status}
                  onQuote={stableOnQuote}
                  messageGroupId={message.metadata?.message_group_id ?? null}
                  isUserAuthenticated={isUserAuthenticated}
                />
              )
            })}
            {/* "streaming" too: status updates at once but the messages
                snapshot is throttled, so the assistant message can lag a frame. */}
            {(status === "submitted" || status === "streaming") &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "user" && (
                // Same width and gutters as the assistant Message that
                // replaces it. Without them the "Thinking…" row sat at the
                // list's left edge and then jumped 24px right the moment the
                // first part arrived, which is what reads as two indicators.
                <div className="group min-h-scroll-anchor flex w-full min-w-0 max-w-3xl flex-col items-start gap-2 px-0 sm:px-6">
                  <Loader />
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
