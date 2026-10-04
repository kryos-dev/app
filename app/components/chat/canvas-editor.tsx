"use client"

import { Crepe } from "@milkdown/crepe"
import { replaceAll } from "@milkdown/kit/utils"
import "@milkdown/crepe/theme/common/style.css"
import "@milkdown/crepe/theme/frame.css"
import { useEffect, useRef } from "react"

// Milkdown Crepe: markdown in, markdown out, edited in place. Theme colors
// are mapped to the app's tokens in globals.css (`.canvas-editor .milkdown`).
export function CanvasEditor({
  content,
  contentVersion,
  onChange,
}: {
  content: string
  /** Bumped when the agent pushes new content; replaces the document. */
  contentVersion: number
  onChange: (markdown: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const lastMarkdown = useRef(content)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let cancelled = false
    const initial = lastMarkdown.current
    const crepe = new Crepe({
      root,
      defaultValue: initial,
      features: {
        [Crepe.Feature.Latex]: false,
        [Crepe.Feature.ImageBlock]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: "Write, or ask the agent to write…" },
      },
    })
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (markdown === lastMarkdown.current) return
        lastMarkdown.current = markdown
        onChangeRef.current(markdown)
      })
    })
    crepe.create().then(() => {
      // React 19 StrictMode runs the effect twice; the first instance is
      // destroyed in cleanup before this resolves.
      if (cancelled) return void crepe.destroy()
      crepeRef.current = crepe
      // A push that landed while the editor was still being created (a
      // canvas opened mid-stream gets one within milliseconds) was dropped.
      if (lastMarkdown.current !== initial) crepe.editor.action(replaceAll(lastMarkdown.current))
    })
    return () => {
      cancelled = true
      crepeRef.current = null
      void crepe.destroy()
    }
  }, [])

  // Agent-pushed content: replace the document, keep the instance.
  useEffect(() => {
    if (contentVersion === 0 || content === lastMarkdown.current) return
    lastMarkdown.current = content
    crepeRef.current?.editor.action(replaceAll(content))
    // `content` too: CanvasTab copies the pushed text into its state in an
    // effect that runs AFTER this child effect, so keyed on the version alone
    // every push rendered the previous push's text. Typing cannot loop back
    // through here: markdownUpdated sets lastMarkdown before onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentVersion, content])

  return (
    <div
      ref={rootRef}
      className="canvas-editor size-full [&_.milkdown]:h-full [&_.milkdown]:bg-transparent [&_.milkdown_.editor]:min-h-full"
    />
  )
}
