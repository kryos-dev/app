"use client"

import { CanvasTab } from "@/app/components/chat/canvas-tab"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { X } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { useWorkspace } from "./workspace-provider"

const MIN_WIDTH = 320
const DEFAULT_WIDTH_PCT = 0.4

export function WorkspacePane() {
  const { isOpen, tabs, activePath, close, setActivePath, closeTab } = useWorkspace()
  const [width, setWidth] = useState<number | null>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const isMobile = useBreakpoint(768)

  const activeTab = tabs.find((t) => t.path === activePath) ?? null

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && paneRef.current?.contains(document.activeElement)) close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [isOpen, close])

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth =
      paneRef.current?.getBoundingClientRect().width ?? window.innerWidth * DEFAULT_WIDTH_PCT
    const onMove = (moveEvent: MouseEvent) => {
      const next = startWidth - (moveEvent.clientX - startX)
      setWidth(Math.min(Math.max(next, MIN_WIDTH), window.innerWidth * 0.8))
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  const body = (
    <>
      {tabs.length > 1 && (
        <div className="border-border flex shrink-0 overflow-x-auto border-b">
          {tabs.map((t) => (
            <button
              key={t.path}
              onClick={() => setActivePath(t.path)}
              className={cn(
                "border-border flex shrink-0 items-center gap-1.5 border-r px-2 py-1 text-xs",
                t.path === activePath ? "bg-muted" : "hover:bg-muted/50"
              )}
            >
              <span className="max-w-32 truncate font-mono">
                {t.title}
              </span>
              <X
                size={12}
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(t.path)
                }}
              />
            </button>
          ))}
        </div>
      )}

      {activeTab && (
        <CanvasTab
          key={activeTab.id}
          canvasId={activeTab.id}
          title={activeTab.title}
          content={activeTab.content}
          contentVersion={activeTab.rev}
          onClose={() => closeTab(activeTab.path)}
        />
      )}
    </>
  )

  // Phones: the side pane below is `hidden` under md, so a canvas
  // opened there set isOpen and showed nothing ("unable to open artifact in
  // mobile"). Same content, full screen, in a sheet with its own close.
  if (isMobile) {
    const activeTitle = activeTab?.title || "Workspace"
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        {/* The sheet's own X is hidden: the canvas header already carries a
            close button in the same corner. */}
        <SheetContent side="bottom" className="h-dvh gap-0 p-0 [&>button:last-child]:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{activeTitle}</SheetTitle>
            <SheetDescription className="sr-only">
              Canvas
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
        </SheetContent>
      </Sheet>
    )
  }

  if (!isOpen) return null

  return (
    <div
      ref={paneRef}
      tabIndex={-1}
      style={{ width: width ?? `${DEFAULT_WIDTH_PCT * 100}%` }}
      className="border-border bg-background relative hidden h-dvh shrink-0 flex-col overflow-hidden border-l md:flex"
    >
      <div
        onMouseDown={startDrag}
        className="hover:bg-border absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize"
      />
      {body}
    </div>
  )
}
