"use client"

import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactHeader,
} from "@/components/ai-elements/artifact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/app/components/workspace/workspace-provider"
import { CopyIcon, DownloadIcon, FileTextIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { CanvasEditor } from "./canvas-editor"

const SAVE_DEBOUNCE_MS = 800

type Selection = { text: string; top: number; left: number }

export function CanvasTab({
  canvasId,
  title: initialTitle,
  content: initialContent,
  contentVersion,
  onClose,
}: {
  canvasId: string
  title: string
  content: string
  /** Bumped whenever the agent pushes new content; re-syncs the local editor state. */
  contentVersion: number
  onClose: () => void
}) {
  const { updateCanvasTitle, sendCanvasInstruction } = useWorkspace()
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [instruction, setInstruction] = useState("")
  const paneRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-sync from the agent's pushed content; user edits never bump contentVersion,
  // so this never clobbers in-progress typing.
  useEffect(() => {
    setContent(initialContent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentVersion])

  const save = (patch: { title?: string; content?: string }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`/api/cloud9/canvas/${canvasId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {})
    }, SAVE_DEBOUNCE_MS)
  }

  const handleTitleChange = (value: string) => {
    setTitle(value)
    updateCanvasTitle(canvasId, value)
    save({ title: value })
  }

  const handleContentChange = (markdown: string) => {
    setContent(markdown)
    save({ content: markdown })
  }

  // Only reacts to selections anchored inside the editor container, so
  // clicking into the popover's own input below never clobbers it.
  const updateSelection = useCallback(() => {
    const editorEl = editorRef.current
    const paneEl = paneRef.current
    if (!editorEl || !paneEl) return
    const sel = window.getSelection()
    const anchorNode = sel?.anchorNode ?? null
    if (!anchorNode || !editorEl.contains(anchorNode)) return
    if (!sel || sel.isCollapsed) {
      setSelection(null)
      return
    }
    const text = sel.toString().trim()
    if (!text) {
      setSelection(null)
      return
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    const paneRect = paneEl.getBoundingClientRect()
    setSelection({
      text,
      top: rect.bottom - paneRect.top + 8,
      left: Math.min(Math.max(rect.left - paneRect.left, 0), paneRect.width - 260),
    })
  }, [])

  useEffect(() => {
    document.addEventListener("selectionchange", updateSelection)
    return () => document.removeEventListener("selectionchange", updateSelection)
  }, [updateSelection])

  const submitInstruction = () => {
    if (!selection || !instruction.trim()) return
    sendCanvasInstruction(
      `In the canvas "${title}", regarding this selection:\n\n${selection.text}\n\n${instruction}\n\nReturn the full updated document in a \`\`\`canvas block.`
    )
    setInstruction("")
    setSelection(null)
  }

  const download = () => {
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title || "document"}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Artifact className="h-full flex-1 rounded-none border-0">
      <ArtifactHeader className="border-0 bg-transparent">
        <div className="flex min-w-0 items-center gap-2">
          <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-7 border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-1"
          />
        </div>
        <ArtifactActions>
          <ArtifactAction
            tooltip="Copy"
            icon={CopyIcon}
            onClick={() => navigator.clipboard.writeText(content)}
          />
          <ArtifactAction tooltip="Download .md" icon={DownloadIcon} onClick={download} />
          <ArtifactClose onClick={onClose} title="Close canvas" />
        </ArtifactActions>
      </ArtifactHeader>

      <ArtifactContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div ref={paneRef} className="relative flex flex-1 flex-col overflow-hidden">
          <div
            ref={editorRef}
            onMouseUp={updateSelection}
            className="prose dark:prose-invert max-w-none flex-1 overflow-auto p-4"
          >
            <CanvasEditor
              content={content}
              contentVersion={contentVersion}
              onChange={handleContentChange}
            />
          </div>

          {selection && (
            <div
              className="bg-popover absolute z-20 flex w-64 flex-col gap-2 rounded-md border p-2 shadow-md"
              style={{ top: selection.top, left: selection.left }}
            >
              <Input
                autoFocus
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitInstruction()}
                placeholder="Make it more creative…"
                className="h-8 text-sm"
              />
              <Button size="sm" className="h-7 self-end" onClick={submitInstruction}>
                Ask
              </Button>
            </div>
          )}
        </div>
      </ArtifactContent>
    </Artifact>
  )
}
