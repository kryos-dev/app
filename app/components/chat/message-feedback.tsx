"use client"

import { MessageAction } from "@/components/ai-elements/message"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { cn } from "@/lib/utils"
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react"
import { useEffect, useState } from "react"

type Rating = 1 | -1 | 0

/**
 * One in-flight request per chat, shared by every message on screen.
 *
 * Without this each assistant message would fetch the same map on mount, so a
 * forty-message chat would open with forty identical requests. A module-level
 * promise is the smallest thing that dedupes them; it does not need to be a
 * provider because nothing else wants this data.
 */
const pending = new Map<string, Promise<Record<string, number>>>()

function loadRatings(chatId: string): Promise<Record<string, number>> {
  let p = pending.get(chatId)
  if (!p) {
    p = fetch(`/api/messages/feedback?chatId=${encodeURIComponent(chatId)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
    pending.set(chatId, p)
  }
  return p
}

/** Drop the cache so the next mount re-reads. Called after a successful vote. */
function invalidate(chatId: string) {
  pending.delete(chatId)
}

export function MessageFeedback({ messageId }: { messageId: string }) {
  const { chatId } = useChatSession()
  const [rating, setRating] = useState<Rating>(0)

  useEffect(() => {
    if (!chatId) return
    let alive = true
    loadRatings(chatId).then((map) => {
      if (!alive) return
      const value = map[messageId]
      if (value === 1 || value === -1) setRating(value)
    })
    return () => {
      alive = false
    }
  }, [chatId, messageId])

  if (!chatId) return null

  const vote = async (next: 1 | -1) => {
    // Pressing the thumb that is already lit clears the vote, which is how
    // every app that has this button behaves and is the only way to undo.
    const value: Rating = rating === next ? 0 : next
    const previous = rating
    setRating(value) // optimistic: the button must respond to a tap immediately
    const res = await fetch("/api/messages/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, messageId, rating: value }),
    }).catch(() => null)
    if (!res?.ok) {
      setRating(previous)
      return
    }
    invalidate(chatId)
  }

  const base =
    "hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"

  return (
    <>
      <MessageAction
        tooltip="Good response"
        label="Good response"
        className={cn(base, rating === 1 && "text-foreground")}
        onClick={() => vote(1)}
      >
        <ThumbsUp className="size-4" weight={rating === 1 ? "fill" : "regular"} />
      </MessageAction>
      <MessageAction
        tooltip="Bad response"
        label="Bad response"
        className={cn(base, rating === -1 && "text-foreground")}
        onClick={() => vote(-1)}
      >
        <ThumbsDown
          className="size-4"
          weight={rating === -1 ? "fill" : "regular"}
        />
      </MessageAction>
    </>
  )
}
