"use client"

import { ButtonTheme } from "@/app/components/layout/button-theme"
import { HeaderSidebarTrigger } from "@/app/components/layout/header-sidebar-trigger"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function Header({ hasSidebar }: { hasSidebar: boolean }) {
  const { open } = useSidebar()

  return (
    <header className="h-app-header pointer-events-none fixed top-0 right-0 left-0 z-50">
      <div className="relative mx-auto flex h-full items-center justify-between bg-transparent pl-2 pr-4 sm:pr-6 lg:bg-transparent lg:pr-8">
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-2 transition-[margin]",
            // keep the left group clear of the open desktop sidebar
            hasSidebar && open && "md:ml-(--sidebar-width)"
          )}
        >
          <HeaderSidebarTrigger
            className={cn(hasSidebar && open && "md:hidden")}
          />
        </div>
        <div className="pointer-events-auto flex items-center">
          <ButtonTheme />
        </div>
      </div>
    </header>
  )
}
