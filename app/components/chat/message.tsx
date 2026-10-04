import { textFromMessage } from "@/lib/chat-store/messages/api"
import type { UIMessage } from "ai"
import React, { useState } from "react"
import { MessageAssistant } from "./message-assistant"
import { MessageUser } from "./message-user"

type MessageProps = {
  variant: UIMessage["role"]
  id: string
  parts: UIMessage["parts"]
  isLast?: boolean
  hasScrollAnchor?: boolean
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  onQuote?: (text: string, messageId: string) => void
}

function MessageImpl({
  variant,
  id,
  parts,
  isLast,
  hasScrollAnchor,
  status,
  className,
  onQuote,
}: MessageProps) {
  const [copied, setCopied] = useState(false)
  const text = textFromMessage({ parts })

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 500)
  }

  if (variant === "user") {
    return (
      <MessageUser
        copied={copied}
        copyToClipboard={copyToClipboard}
        hasScrollAnchor={hasScrollAnchor}
        parts={parts}
        className={className}
      />
    )
  }

  if (variant === "assistant") {
    return (
      <MessageAssistant
        copied={copied}
        copyToClipboard={copyToClipboard}
        isLast={isLast}
        hasScrollAnchor={hasScrollAnchor}
        parts={parts}
        status={status}
        className={className}
        messageId={id}
        onQuote={onQuote}
      />
    )
  }

  return null
}

// The AI SDK replaces the `messages` array on every streamed token, so
// Conversation re-maps it token by token. Without this, every PREVIOUS message
// -- its markdown, its tool cards, its syntax highlighting -- re-rendered on
// every token of the message currently arriving. A finished message cannot
// change, so comparing the fields that actually drive its output is enough.
export const Message = React.memo(MessageImpl, (a, b) => {
  if (a.id !== b.id || a.variant !== b.variant) return false
  // Only the streaming message's parts and status move; comparing the array
  // reference is what makes the finished ones cheap.
  if (a.parts !== b.parts || a.status !== b.status || a.isLast !== b.isLast) {
    return false
  }
  return (
    a.className === b.className &&
    a.hasScrollAnchor === b.hasScrollAnchor
  )
})
Message.displayName = "Message"
