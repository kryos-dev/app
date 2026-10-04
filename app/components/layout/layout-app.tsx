"use client"

import { Header } from "@/app/components/layout/header"
import { AppSidebar } from "@/app/components/layout/sidebar/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { WorkspacePane } from "@/app/components/workspace/workspace-pane"
import { WorkspaceProvider } from "@/app/components/workspace/workspace-provider"

export function LayoutApp({ children }: { children: React.ReactNode }) {
  const hasSidebar = true

  return (
      <WorkspaceProvider>
        {/* shadcn's inset sidebar (Linear's layout): the page is a rounded
            panel sitting on the sidebar colour. The panel stretches to the
            row's height instead of h-dvh, so its margin comes off the height
            instead of pushing it past the viewport. */}
        <div className="bg-sidebar flex h-dvh w-full overflow-hidden">
          {hasSidebar && <AppSidebar />}
          <SidebarInset className="@container w-0 flex-shrink flex-grow overflow-y-auto md:peer-data-[variant=inset]:border">
            <Header hasSidebar={hasSidebar} />
            {children}
          </SidebarInset>
          <WorkspacePane />
        </div>
      </WorkspaceProvider>
  )
}
