import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuAction } from "@/components/ui/sidebar"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { Chat } from "@/lib/chat-store/types"
import { toast } from "@/components/ui/toast"
import {
  Check,
  DotsThree,
  FolderIcon,
  LinkBreakIcon,
  LinkIcon,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { Pin, PinOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { DialogDeleteChat } from "./dialog-delete-chat"

type Project = { id: string; name: string }

type SidebarItemMenuProps = {
  chat: Chat
  onStartEditing: () => void
  onMenuOpenChange?: (open: boolean) => void
}

export function SidebarItemMenu({
  chat,
  onStartEditing,
  onMenuOpenChange,
}: SidebarItemMenuProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const router = useRouter()
  const { deleteMessages } = useMessages()
  const { deleteChat, togglePinned, moveChatToProject, setChatPublic } = useChats()
  const { chatId } = useChatSession()
  const isMobile = useBreakpoint(768)

  // Same query key as the sidebar's own project list, so opening this menu
  // costs nothing after the first fetch.
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to load projects")
      return res.json()
    },
  })

  // /share/[chatId] serves a chat only once it is published, so the one
  // action does both: mark it public, then hand over the link. Choosing it
  // again unpublishes, which is what makes the old link stop working.
  const share = async () => {
    if (chat.public) {
      await setChatPublic(chat.id, false)
      toast({ title: "Link turned off", status: "info" })
      return
    }
    await setChatPublic(chat.id, true)
    const url = `${window.location.origin}/share/${chat.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "Share link copied", status: "success" })
    } catch {
      toast({ title: url, status: "info" })
    }
  }

  const handleConfirmDelete = async () => {
    await deleteMessages()
    await deleteChat(chat.id, chatId!, () => router.push("/"))
  }

  return (
    <>
      <DropdownMenu
        // shadcn/ui / radix pointer-events-none issue
        modal={isMobile ? true : false}
        onOpenChange={onMenuOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover onClick={(e) => e.stopPropagation()}>
            <DotsThree size={16} weight="bold" />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              togglePinned(chat.id, !chat.pinned)
            }}
          >
            {chat.pinned ? (
              <PinOff size={16} className="mr-2" />
            ) : (
              <Pin size={16} className="mr-2" />
            )}
            {chat.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          {projects.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderIcon size={16} className="mr-2" />
                Add to project
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onSelect={() => moveChatToProject(chat.id, project.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {chat.project_id === project.id && <Check size={14} />}
                  </DropdownMenuItem>
                ))}
                {chat.project_id && (
                  <DropdownMenuItem onSelect={() => moveChatToProject(chat.id, null)}>
                    Remove from project
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => share()}
          >
            {chat.public ? (
              <LinkBreakIcon size={16} className="mr-2" />
            ) : (
              <LinkIcon size={16} className="mr-2" />
            )}
            {chat.public ? "Stop sharing" : "Copy share link"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onStartEditing()
            }}
          >
            <PencilSimple size={16} className="mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDeleteDialogOpen(true)
            }}
          >
            <Trash size={16} className="mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogDeleteChat
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        chatTitle={chat.title || "Untitled chat"}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  )
}
