import useClickOutside from "@/app/hooks/use-click-outside"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useChats } from "@/lib/chat-store/chats/provider"
import { Chat } from "@/lib/chat-store/types"
import { Check, X } from "@phosphor-icons/react"
import Link from "next/link"
import { useCallback, useMemo, useRef, useState } from "react"
import { SidebarItemMenu } from "./sidebar-item-menu"

type SidebarItemProps = {
  chat: Chat
  currentChatId: string
}

export function SidebarItem({ chat, currentChatId }: SidebarItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(chat.title || "")
  const inputRef = useRef<HTMLInputElement>(null)
  const lastChatTitleRef = useRef(chat.title)
  const { updateTitle } = useChats()
  const containerRef = useRef<HTMLLIElement | null>(null)

  if (!isEditing && lastChatTitleRef.current !== chat.title) {
    lastChatTitleRef.current = chat.title
    setEditTitle(chat.title || "")
  }

  const handleStartEditing = useCallback(() => {
    setIsEditing(true)
    setEditTitle(chat.title || "")

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    })
  }, [chat.title])

  const handleSave = useCallback(async () => {
    setIsEditing(false)
    await updateTitle(chat.id, editTitle)
  }, [chat.id, editTitle, updateTitle])

  const handleCancel = useCallback(() => {
    setEditTitle(chat.title || "")
    setIsEditing(false)
  }, [chat.title])

  const handleClickOutside = useCallback(() => {
    if (isEditing) {
      handleSave()
    }
  }, [isEditing, handleSave])

  useClickOutside(containerRef, handleClickOutside)

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditTitle(e.target.value)
    },
    []
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSave()
      } else if (e.key === "Escape") {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) {
        e.stopPropagation()
      }
    },
    [isEditing]
  )

  const handleSaveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleSave()
    },
    [handleSave]
  )

  const handleCancelClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleCancel()
    },
    [handleCancel]
  )

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  // Memoize computed values
  const isActive = useMemo(
    () => chat.id === currentChatId,
    [chat.id, currentChatId]
  )

  const displayTitle = useMemo(
    () => chat.title || "Untitled Chat",
    [chat.title]
  )

  return (
    <SidebarMenuItem onClick={handleContainerClick} ref={containerRef}>
      {isEditing ? (
        <div className="bg-sidebar-accent flex items-center rounded-md py-1 pr-1 pl-2">
          <input
            ref={inputRef}
            value={editTitle}
            onChange={handleInputChange}
            className="text-primary max-h-full w-full bg-transparent text-sm focus:outline-none"
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-0.5">
            <button
              onClick={handleSaveClick}
              className="hover:bg-secondary text-muted-foreground hover:text-primary flex size-7 items-center justify-center rounded-md p-1 transition-colors duration-150"
              type="button"
            >
              <Check size={16} weight="bold" />
            </button>
            <button
              onClick={handleCancelClick}
              className="hover:bg-secondary text-muted-foreground hover:text-primary flex size-7 items-center justify-center rounded-md p-1 transition-colors duration-150"
              type="button"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <SidebarMenuButton asChild isActive={isActive}>
            <Link
              href={`/c/${chat.id}`}
              prefetch
              onClick={handleLinkClick}
              title={displayTitle}
            >
              <span className="truncate">{displayTitle}</span>
            </Link>
          </SidebarMenuButton>
          <SidebarItemMenu chat={chat} onStartEditing={handleStartEditing} />
        </>
      )}
    </SidebarMenuItem>
  )
}
