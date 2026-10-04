"use client"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  ClockCounterClockwiseIcon,
  FolderIcon,
  ImagesIcon,
  MagnifyingGlass,
  NotePencilIcon,
  PlugsConnectedIcon,
  PuzzlePieceIcon,
} from "@phosphor-icons/react"
import { useUser } from "@/lib/user-store/provider"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HistoryTrigger } from "../../history/history-trigger"

// Claude's order: Projects, Customize (skills + connectors on one page),
// Scheduled.
//
// The admin ones drive the agent for everyone on the box -- its skills, its
// connectors, its cron jobs -- so their APIs answer 403 to anyone who is not
// the operator. Leaving the links up would just be pages of error text for a
// guest; hiding them is presentation, not the check.
const NAV_ITEMS = [
  { href: "/projects", label: "Projects", icon: FolderIcon },
  // The image library (apps/menaka) is its own app on its own host; the
  // sidebar is where people look for it.
  { href: "https://menaka.kryos.dev", label: "Images", icon: ImagesIcon },
  { href: "/customize", label: "Customize", icon: PuzzlePieceIcon, admin: true },
  {
    href: "/scheduled",
    label: "Scheduled",
    icon: ClockCounterClockwiseIcon,
    admin: true,
  },
  { href: "/providers", label: "Providers", icon: PlugsConnectedIcon, admin: true },
]

// Mirrors sidebarMenuButtonVariants({ size: "default" }) since HistoryTrigger
// renders its own <button> and can't be wrapped with SidebarMenuButton asChild.
export const sidebarRowTriggerClassName =
  "peer/menu-button bg-transparent text-sidebar-foreground flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0"

export function NavMain() {
  const pathname = usePathname()
  const { user } = useUser()

  return (
    <SidebarMenu className="mb-3 gap-0.5">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname === "/"}
          tooltip="New chat"
        >
          <Link href="/" prefetch>
            <NotePencilIcon size={16} />
            <span>New chat</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <HistoryTrigger
          hasSidebar={false}
          classNameTrigger={sidebarRowTriggerClassName}
          icon={<MagnifyingGlass size={16} />}
          label={<span>Search</span>}
          hasPopover={false}
        />
      </SidebarMenuItem>
      {NAV_ITEMS.filter((item) => !item.admin || user?.is_admin).map((item) => {
        const isActive = pathname?.startsWith(item.href)
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
              <Link href={item.href} prefetch>
                <item.icon size={16} />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
