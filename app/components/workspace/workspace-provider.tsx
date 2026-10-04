"use client"

import { createContext, useContext, useRef, useState, type ReactNode } from "react"

const MAX_TABS = 6

export type WorkspaceTab = {
  kind: "canvas"
  path: string
  id: string
  title: string
  content: string
  rev: number
}

type WorkspaceContextType = {
  isOpen: boolean
  tabs: WorkspaceTab[]
  activePath: string | null
  /** Creates/focuses a canvas tab (New canvas, Open in canvas, clicking a canvas card). */
  openCanvas: (id: string, title: string, content: string) => void
  /** Pushes fresh content/title into an already-open canvas tab without stealing focus. */
  updateCanvasContent: (id: string, content: string, title?: string) => void
  updateCanvasTitle: (id: string, title: string) => void
  close: () => void
  setActivePath: (path: string) => void
  closeTab: (path: string) => void
  /** Sends free-form text through the chat composer's submit path (see canvas selection prompt). */
  sendCanvasInstruction: (text: string) => void
  /** Chat.tsx registers its submit handler here once; canvas UI calls sendCanvasInstruction. */
  registerCanvasInstructionHandler: (fn: (text: string) => void) => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

const canvasPath = (id: string) => `canvas:${id}`

// Right-pane canvas state lives above the chat/layout split so both the chat
// (open) and the workspace pane (render) can reach it.
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const instructionHandlerRef = useRef<(text: string) => void>(() => {})

  const openCanvas = (id: string, title: string, content: string) => {
    const path = canvasPath(id)
    setTabs((prev) => {
      const existing = prev.find((t) => t.path === path)
      const rev = existing ? existing.rev + 1 : 0
      const next = [
        ...prev.filter((t) => t.path !== path),
        { kind: "canvas" as const, path, id, title, content, rev },
      ]
      return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next
    })
    setActivePath(path)
    setIsOpen(true)
  }

  const updateCanvasContent = (id: string, content: string, title?: string) => {
    const path = canvasPath(id)
    setTabs((prev) =>
      prev.map((t) =>
        t.path === path
          ? { ...t, content, title: title ?? t.title, rev: t.rev + 1 }
          : t
      )
    )
  }

  const updateCanvasTitle = (id: string, title: string) => {
    const path = canvasPath(id)
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, title } : t))
    )
  }

  const closeTab = (path: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path)
      setActivePath((current) =>
        current === path ? (next.length ? next[next.length - 1].path : null) : current
      )
      // Closing the last tab closes the pane; an empty pane had no way out.
      if (!next.length) setIsOpen(false)
      return next
    })
  }

  return (
    <WorkspaceContext.Provider
      value={{
        isOpen,
        tabs,
        activePath,
        openCanvas,
        updateCanvasContent,
        updateCanvasTitle,
        close: () => setIsOpen(false),
        setActivePath,
        closeTab,
        sendCanvasInstruction: (text) => instructionHandlerRef.current(text),
        registerCanvasInstructionHandler: (fn) => {
          instructionHandlerRef.current = fn
        },
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return context
}
