"use client"

import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogImage,
  MorphingDialogTrigger,
} from "@/components/motion-primitives/morphing-dialog"
import {
  MessageAction,
  MessageActions,
  Message as MessageContainer,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { Button } from "@/components/ui/button"
import { attachmentsFromMessage, textFromMessage } from "@/lib/chat-store/messages/api"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import {
  ArrowClockwise,
  Check,
  Copy,
  PencilSimpleIcon,
  PencilSimpleSlashIcon,
} from "@phosphor-icons/react"
import Image from "next/image"
import React, { useEffect, useRef, useState } from "react"

const getTextFromDataUrl = (dataUrl: string) => {
  const base64 = dataUrl.split(",")[1]
  return base64
}

export type MessageUserProps = {
  hasScrollAnchor?: boolean
  parts: UIMessage["parts"]
  copied: boolean
  copyToClipboard: () => void
  id: string
  className?: string
  onReload?: () => void
  onEdit?: (id: string, newText: string) => void
  messageGroupId?: string | null
  isUserAuthenticated?: boolean
}

export function MessageUser({
  hasScrollAnchor,
  parts,
  copied,
  copyToClipboard,
  id,
  className,
  onEdit,
  onReload,
  messageGroupId,
  isUserAuthenticated,
}: MessageUserProps) {
  const children = textFromMessage({ parts })
  const attachments = attachmentsFromMessage({ parts })
  const [editInput, setEditInput] = useState(children)
  const [isEditing, setIsEditing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditInput(children)
  }

  const handleSave = async () => {
    if (!editInput.trim()) return

    // No id-shape check here. There used to be one -- `id.length !== 36` meant
    // "not a database UUID", which was read as "ids failed to sync" and told
    // the owner to refresh the browser. It rejected the commonest edit there
    // is: a message you just sent still carries its optimistic id
    // (`optimistic-1758…`, 24 chars) until the chat is reloaded, so editing
    // your own last message ALWAYS failed, and refreshing was the only way to
    // make the button work.
    //
    // The id never justified the check. submitEdit sends the server
    // `editCutoffTimestamp` (the message's createdAt) and nothing else; the id
    // is used only to find the message in the local array, where an optimistic
    // id works exactly as well as a UUID. A message that genuinely cannot be
    // found is reported by submitEdit itself.
    try {
      onEdit?.(id, editInput)
    } catch {
      setEditInput(children) // Reset on failure
    } finally {
      setIsEditing(false)
    }
  }

  const handleEditStart = async () => {
    setIsEditing(true)
    setEditInput(children)
  }

  useEffect(() => {
    if (!isEditing) return
    const editTextarea = textareaRef.current
    if (!editTextarea) return
    editTextarea.style.height = "auto"
    editTextarea.style.height = `${Math.min(editTextarea.scrollHeight, editTextarea.scrollHeight)}px`
  }, [editInput, isEditing])

  return (
    <MessageContainer
      from="user"
      className={cn(
        // Same gutter fix as message-assistant: 56px each side at 390px.
        "group flex w-full max-w-3xl flex-col items-end gap-0.5 px-0 pb-2 sm:px-6",
        hasScrollAnchor && "min-h-scroll-anchor",
        className
      )}
    >
      {attachments?.map((attachment, index) => (
        <div
          className="flex flex-row gap-2"
          key={`${attachment.name}-${index}`}
        >
          {attachment.contentType?.startsWith("image") ? (
            <MorphingDialog
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 18,
                mass: 0.3,
              }}
            >
              <MorphingDialogTrigger className="z-10">
                <Image
                  className="mb-1 w-40 rounded-md"
                  key={attachment.name}
                  src={attachment.url}
                  alt={attachment.name || "Attachment"}
                  width={160}
                  height={120}
                />
              </MorphingDialogTrigger>
              <MorphingDialogContainer>
                <MorphingDialogContent className="relative rounded-lg">
                  <MorphingDialogImage
                    src={attachment.url}
                    alt={attachment.name || ""}
                    className="max-h-[90vh] max-w-[90vw] object-contain"
                  />
                </MorphingDialogContent>
                <MorphingDialogClose className="text-primary" />
              </MorphingDialogContainer>
            </MorphingDialog>
          ) : attachment.contentType?.startsWith("text") ? (
            <div className="text-primary mb-3 h-24 w-40 overflow-hidden rounded-md border p-2 text-xs">
              {getTextFromDataUrl(attachment.url)}
            </div>
          ) : null}
        </div>
      ))}
      {isEditing ? (
        <div
          className="bg-accent relative flex w-full max-w-xl min-w-45 flex-col gap-2 rounded-3xl px-5 py-2.5"
          style={{
            width: contentRef.current?.offsetWidth,
          }}
        >
          <textarea
            ref={textareaRef}
            className="w-full resize-none bg-transparent outline-none"
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSave()
              }
              if (e.key === "Escape") {
                handleEditCancel()
              }
            }}
            autoFocus
            style={{
              maxHeight: "50vh",
              overflowY: "auto",
            }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleEditCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!editInput.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <MessageContent
          ref={contentRef}
          // Not `break-words` as well: both set overflow-wrap, `break-word`
          // won, and a pasted URL ran out of the bubble (390px).
          className="bg-accent prose dark:prose-invert relative max-w-3/4 rounded-3xl px-5 py-2.5 [overflow-wrap:anywhere]"
        >
          <MessageResponse
            components={{
              code: ({ children }) => <React.Fragment>{children}</React.Fragment>,
              pre: ({ children }) => <React.Fragment>{children}</React.Fragment>,
              h1: ({ children }) => <p>{children}</p>,
              h2: ({ children }) => <p>{children}</p>,
              h3: ({ children }) => <p>{children}</p>,
              h4: ({ children }) => <p>{children}</p>,
              h5: ({ children }) => <p>{children}</p>,
              h6: ({ children }) => <p>{children}</p>,
              p: ({ children }) => <p>{children}</p>,
              li: ({ children }) => <p>- {children}</p>,
              ul: ({ children }) => <React.Fragment>{children}</React.Fragment>,
              ol: ({ children }) => <React.Fragment>{children}</React.Fragment>,
            }}
          >
            {children}
          </MessageResponse>
        </MessageContent>
      )}
      {/* Visible on touch, hover-revealed from md up: a phone never fires
          hover, so copy and edit were unreachable here. See #31. */}
      <MessageActions className="flex gap-0 transition-opacity duration-0 opacity-100 md:opacity-0 md:group-hover:opacity-100">
        <MessageAction
          tooltip={copied ? "Copied!" : "Copy text"}
          label="Copy text"
          className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
          onClick={copyToClipboard}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </MessageAction>
        {messageGroupId === null && isUserAuthenticated && (
          // Enabled if NOT multi-model chat & user is Authenticated
          <MessageAction
            tooltip={isEditing ? "Cancel edit" : "Edit message"}
            label={isEditing ? "Cancel edit" : "Edit message"}
            className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
            onClick={isEditing ? handleEditCancel : handleEditStart}
          >
            {isEditing ? (
              <PencilSimpleSlashIcon className="size-4" />
            ) : (
              <PencilSimpleIcon className="size-4" />
            )}
          </MessageAction>
        )}
        {/* Run this message again without retyping it. message.tsx has always
            passed onReload down here; only the button was missing, so the one
            way to re-ask was to edit the message and save it unchanged --
            which is exactly the path that used to fail. */}
        {onReload && messageGroupId === null && (
          <MessageAction
            tooltip="Try again"
            label="Try again"
            className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
            onClick={onReload}
          >
            <ArrowClockwise className="size-4" />
          </MessageAction>
        )}
      </MessageActions>
    </MessageContainer>
  )
}
