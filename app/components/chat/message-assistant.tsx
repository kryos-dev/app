import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { useWorkspace } from "@/app/components/workspace/workspace-provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { textFromMessage } from "@/lib/chat-store/messages/api"
import { parseCanvasSegments } from "@/lib/canvas/parse"
import { chunkForSpeech } from "@/lib/speech-chunks"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { cn } from "@/lib/utils"
import { isToolUIPart, type UIMessage } from "ai"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  ArrowClockwise,
  Check,
  Copy,
  FileText,
  SpeakerHighIcon,
  StopIcon,
} from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { CanvasBlock } from "./canvas-block"
import { Loader } from "./loader"
import { MessageFeedback } from "./message-feedback"
import { QuoteButton } from "./quote-button"
import { segmentParts, WorkGroup } from "./work-group"
import { turnFromParts } from "@/lib/turn"
import { useAssistantMessageSelection } from "./useAssistantMessageSelection"

type MessageAssistantProps = {
  parts: UIMessage["parts"]
  isLast?: boolean
  hasScrollAnchor?: boolean
  copied?: boolean
  copyToClipboard?: () => void
  onReload?: () => void
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  messageId: string
  onQuote?: (text: string, messageId: string) => void
}

export function MessageAssistant({
  parts,
  isLast,
  hasScrollAnchor,
  copied,
  copyToClipboard,
  onReload,
  status,
  className,
  messageId,
  onQuote,
}: MessageAssistantProps) {
  const { preferences } = useUserPreferences()
  const children = textFromMessage({ parts })
  const toolInvocationParts = parts?.filter(isToolUIPart) ?? []
  const reasoningPart = parts?.find(
    (part): part is { type: "reasoning"; text: string } => part.type === "reasoning"
  )
  const runs = segmentParts(parts ?? [])
  const answerText = children
  const contentNullOrEmpty = answerText === null || answerText === ""
  const isLastStreaming = status === "streaming" && isLast
  const turn = turnFromParts(parts)
  const { chatId } = useChatSession()
  const { openCanvas } = useWorkspace()
  const handleOpenInCanvas = useCallback(async () => {
    if (!chatId || contentNullOrEmpty) return
    const res = await fetch("/api/cloud9/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, title: "Untitled", content: answerText }),
    })
    if (!res.ok) return
    const canvas = await res.json()
    openCanvas(canvas.id, canvas.title, canvas.content)
  }, [chatId, contentNullOrEmpty, answerText, openCanvas])
  const hasVisiblePart =
    // Any reasoning part: an empty one is already a shimmering "Thinking" row.
    Boolean(reasoningPart) ||
    toolInvocationParts.length > 0 ||
    !contentNullOrEmpty
  const showThinking =
    isLast && (status === "submitted" || status === "streaming") && !hasVisiblePart

  const isQuoteEnabled = !preferences.multiModelEnabled
  const messageRef = useRef<HTMLDivElement>(null)
  const { selectionInfo, clearSelection } = useAssistantMessageSelection(
    messageRef,
    isQuoteEnabled
  )
  const handleQuoteBtnClick = useCallback(() => {
    if (selectionInfo && onQuote) {
      onQuote(selectionInfo.text, selectionInfo.messageId)
      clearSelection()
    }
  }, [selectionInfo, onQuote, clearSelection])

  return (
    <Message
      from="assistant"
      className={cn(
        // No side padding of its own on a phone: with the list's px-4 and the
        // page's p-4 it added up to a 56px gutter each side and a 278px column
        // on a 390px screen, so a 4-column table showed 3.
        "group flex w-full max-w-3xl flex-1 items-start gap-4 px-0 pb-2 sm:px-6",
        hasScrollAnchor && "min-h-scroll-anchor",
        className
      )}
    >
      <div
        ref={messageRef}
        className="relative flex w-full min-w-0 max-w-full flex-col gap-2"
        {...(isQuoteEnabled && { "data-message-id": messageId })}
      >
        {showThinking && <Loader />}

        {runs.map((run, i) =>
          run.kind === "work" ? (
            <WorkGroup
              key={i}
              parts={run.parts}
              // Only the last run of the streaming message is live, so only
              // one label on the page ever shimmers.
              live={Boolean(
                isLast &&
                  i === runs.length - 1 &&
                  (status === "streaming" || status === "submitted")
              )}
              timings={turn?.tools}
              showTools={preferences.showToolInvocations}
            />
          ) : (
            parseCanvasSegments(run.text).map((segment, j) =>
              segment.kind === "canvas" ? (
                <CanvasBlock
                  key={`${i}-${j}`}
                  title={segment.title}
                  content={segment.content}
                  complete={segment.complete}
                  streaming={Boolean(isLastStreaming)}
                />
              ) : segment.text.trim() ? (
                <MessageContent
                  key={`${i}-${j}`}
                  className={cn(
                    // `anywhere`, not `break-word`: only the former lowers the
                    // min-content width, so a bare URL wraps instead of being
                    // clipped by the overflow-hidden wrapper at phone width.
                    // Tables are reset: their wrapper scrolls sideways, and
                    // `anywhere` inherited into cells split "deepseek" into
                    // three-letter lines.
                    "prose dark:prose-invert relative w-full min-w-0 max-w-full bg-transparent p-0 [overflow-wrap:anywhere] [&_table]:[overflow-wrap:normal]",
                    "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
                  )}
                >
                  <MessageResponse>{segment.text}</MessageResponse>
                </MessageContent>
              ) : null
            )
          )
        )}

        {Boolean(isLastStreaming || contentNullOrEmpty) ? null : (
          <MessageActions
            className={cn(
              // Visible by default, hover-revealed only from md up.
              //
              // This row was `opacity-0 group-hover:opacity-100` at every width,
              // and a touch screen has no hover -- so copy, canvas and
              // regenerate were not merely hard to find on a phone, they were
              // unreachable. The owner uses this on a phone almost exclusively.
              // Adding a thumbs button to a row nobody can see would not have
              // shipped a feature.
              "-ml-2 flex gap-0 transition-opacity",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100"
            )}
          >
            <MessageAction
              tooltip={copied ? "Copied!" : "Copy text"}
              label="Copy text"
              className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
              onClick={copyToClipboard}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </MessageAction>
            <MessageAction
              tooltip="Open in canvas"
              label="Open in canvas"
              className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
              onClick={handleOpenInCanvas}
            >
              <FileText className="size-4" />
            </MessageAction>
            <ReadAloudAction text={answerText} />
            {isLast ? (
              <MessageAction
                tooltip="Regenerate"
                label="Regenerate"
                className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
                onClick={onReload}
              >
                <ArrowClockwise className="size-4" />
              </MessageAction>
            ) : null}
            <MessageFeedback messageId={messageId} />
          </MessageActions>
        )}

        {isQuoteEnabled && selectionInfo && selectionInfo.messageId && (
          <QuoteButton
            mousePosition={selectionInfo.position}
            onQuote={handleQuoteBtnClick}
            messageContainerRef={messageRef}
            onDismiss={clearSelection}
          />
        )}
      </div>
    </Message>
  )
}

// Speaks the answer through /api/voice/speech. Tap again
// to stop. The Audio element is created and play()ed inside the tap itself:
// iOS Safari only lets an element play if it was started from a gesture, and
// by the time the fetch returns the gesture is gone.
// 0.05s of silence, 8kHz mono PCM: the shortest thing that is a real media
// source, so the tap counts as a play for the autoplay policy.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAACAgICAgICAgICAgICAgA=="

function ReadAloudAction({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle")
  const audio = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    const a = audio.current
    audio.current = null
    if (a) {
      a.pause()
      if (a.src.startsWith("blob:")) URL.revokeObjectURL(a.src)
    }
    setState("idle")
  }, [])

  useEffect(() => stop, [stop])

  const start = async () => {
    const a = new Audio()
    // Unlock with a real (silent) source, not an empty element: play() with no
    // src REJECTS, which Firefox and Brave count as "never played", so the
    // first chunk then hits their autoplay block once the tap is long gone.
    a.src = SILENT_WAV
    a.play().catch(() => {})
    audio.current = a
    setState("loading")

    // Kokoro synthesises at about real time on our CPU, so rendering the whole
    // answer first means waiting out its own length in silence. One chunk at a
    // time, with the next one rendering while this one plays.
    const render = async (chunk: string) => {
      const res = await fetch("/api/voice/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk }),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      return URL.createObjectURL(await res.blob())
    }

    try {
      const chunks = chunkForSpeech(text)
      // ONE render at a time. Two in flight was measured worse, not better
      // (6.4s to first sound against 3.3s): speaches is CPU-bound on a shared
      // three cores, so a second request steals from the one being waited on.
      // The gap is closed by chunk SIZE instead -- synthesis runs at about 0.6x
      // real time, so the next chunk lands before the current one finishes.
      let pending = chunks.length ? render(chunks[0]) : null
      for (let i = 0; pending; i++) {
        const url = await pending
        pending = i + 1 < chunks.length ? render(chunks[i + 1]) : null
        if (audio.current !== a) return URL.revokeObjectURL(url) // stopped meanwhile
        a.src = url
        setState("playing")
        await new Promise<void>((resolve, reject) => {
          a.onended = () => resolve()
          a.onerror = () => reject(new Error("playback failed"))
          a.play().catch(reject)
        })
        URL.revokeObjectURL(url)
      }
      if (audio.current === a) stop()
    } catch (err) {
      if (audio.current === a) {
        stop()
        toast({ title: `Read aloud failed: ${(err as Error).message}`, status: "error" })
      }
    }
  }

  const active = state !== "idle"
  return (
    <MessageAction
      tooltip={active ? "Stop reading" : "Read aloud"}
      label={active ? "Stop reading" : "Read aloud"}
      className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
      onClick={() => (active ? stop() : void start())}
    >
      {state === "loading" ? (
        <Spinner />
      ) : state === "playing" ? (
        <StopIcon className="size-4" />
      ) : (
        <SpeakerHighIcon className="size-4" />
      )}
    </MessageAction>
  )
}
