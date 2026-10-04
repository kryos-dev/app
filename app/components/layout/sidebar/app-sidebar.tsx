"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { ZolaIcon } from "@/components/icons/zola"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useChats } from "@/lib/chat-store/chats/provider"
import { APP_NAME } from "@/lib/config"
import { signOutUser } from "@/lib/user-store/api"
import { useUser } from "@/lib/user-store/provider"
import {
  ChatTeardropText,
  DotsThreeIcon,
  FolderIcon,
  PlusIcon,
  SidebarSimpleIcon,
  SignOut,
  X,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { HistoryTrigger } from "../../history/history-trigger"
import { NavMain, sidebarRowTriggerClassName } from "./nav-main"
import { SidebarItem } from "./sidebar-item"

// Same shape and query as the Projects page (app/(cloud9)/projects/page.tsx)
// so both share one react-query cache entry instead of two fetches.
type Project = { id: string; name: string }

const RECENT_CHATS_LIMIT = 12
const SIDEBAR_PROJECTS_LIMIT = 5

export function AppSidebar() {
  const isMobile = useBreakpoint(768)
  const { setOpenMobile, toggleSidebar } = useSidebar()
  const { chats, isLoading } = useChats()
  const { user } = useUser()
  const params = useParams<{ chatId?: string; projectId?: string }>()
  const currentChatId = params.chatId

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to load projects")
      return res.json()
    },
  })

  // Project scope comes from WHERE you are, not from a picker: inside a
  // project page, or inside a chat that belongs to one, the chat list shows
  // that project's chats only; anywhere else it shows everything. There used
  // to be an "All chats" switcher row for this, which was dropped
  // in favour of a Projects section, copied below.
  const scopeProjectId =
    params.projectId ??
    chats.find((chat) => chat.id === currentChatId)?.project_id ??
    null
  const scopeProject = projects.find((p) => p.id === scopeProjectId)

  const visibleChats = useMemo(
    () =>
      scopeProjectId
        ? chats.filter((chat) => chat.project_id === scopeProjectId)
        : chats,
    [chats, scopeProjectId]
  )
  const pinnedChats = visibleChats.filter((chat) => chat.pinned)
  const unpinnedChats = visibleChats.filter((chat) => !chat.pinned)
  const recentChats = unpinnedChats.slice(0, RECENT_CHATS_LIMIT)
  const hasMoreChats = unpinnedChats.length > RECENT_CHATS_LIMIT

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="h-14 pl-3">
        <div className="flex h-full items-center justify-between pr-1">
          <span className="text-foreground flex min-w-0 items-center gap-2 p-1 text-sm font-semibold">
            <ZolaIcon className="size-4 shrink-0" />
            <span className="truncate">{APP_NAME}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-8"
            onClick={isMobile ? () => setOpenMobile(false) : toggleSidebar}
            aria-label={isMobile ? "Close sidebar" : "Toggle sidebar"}
          >
            {isMobile ? <X size={18} /> : <SidebarSimpleIcon size={18} />}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex h-full px-2 [&>div>div]:!block">
          <NavMain />

          <SidebarGroup className="p-0">
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupAction asChild title="New project">
              <Link href="/projects?new=1" aria-label="New project">
                <PlusIcon />
              </Link>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.slice(0, SIDEBAR_PROJECTS_LIMIT).map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={project.id === scopeProjectId}
                    >
                      <Link href={`/p/${project.id}`}>
                        <FolderIcon size={16} />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {projects.length === 0 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild className="text-muted-foreground">
                      <Link href="/projects">
                        <PlusIcon size={16} />
                        <span>New project</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {projects.length > SIDEBAR_PROJECTS_LIMIT && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild className="text-muted-foreground">
                      <Link href="/projects">
                        <DotsThreeIcon size={16} weight="bold" />
                        <span>All projects</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isLoading ? null : visibleChats.length > 0 ? (
            <>
              {pinnedChats.length > 0 && (
                <SidebarGroup className="p-0">
                  <SidebarGroupLabel>Pinned</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {pinnedChats.map((chat) => (
                        <SidebarItem
                          key={chat.id}
                          chat={chat}
                          currentChatId={currentChatId ?? ""}
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
              <SidebarGroup className="p-0">
                <SidebarGroupLabel>
                  <span className="truncate">
                    {scopeProject ? `Chats in ${scopeProject.name}` : "Chats"}
                  </span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {recentChats.map((chat) => (
                      <SidebarItem
                        key={chat.id}
                        chat={chat}
                        currentChatId={currentChatId ?? ""}
                      />
                    ))}
                    {hasMoreChats && (
                      <SidebarMenuItem>
                        <HistoryTrigger
                          hasSidebar={false}
                          classNameTrigger={sidebarRowTriggerClassName}
                          icon={<DotsThreeIcon size={16} weight="bold" />}
                          label={<span>More</span>}
                          hasPopover={false}
                        />
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center gap-1 py-12 text-center">
              <ChatTeardropText size={24} className="opacity-40" />
              <p className="text-sm font-medium">No chats yet</p>
              <p className="text-13">Start a new conversation</p>
            </div>
          )}
        </ScrollArea>
      </SidebarContent>

      {/* No menu behind the avatar: the dropdown version misbehaved and the
          a single plain logout button replaces it.
          No settings gear: Settings is gone, its Models tab and agent
          instructions live on Customize and Usage has its own page. */}
      <SidebarFooter className="flex-row items-center gap-1 p-2">
        <Avatar className="size-6 shrink-0">
          <AvatarImage src={user?.profile_image ?? undefined} />
          <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="text-foreground min-w-0 flex-1 truncate px-1 text-sm font-medium">
          {user?.display_name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-8"
          aria-label="Log out"
          onClick={() => signOutUser()}
        >
          <SignOut size={18} />
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
