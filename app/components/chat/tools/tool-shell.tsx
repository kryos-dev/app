"use client"

import {
  CodeBlock,
  CodeBlockCode,
} from "@/components/prompt-kit/code-block"
import type { ToolPart } from "@/components/ai-elements/tool"
import { cn } from "@/lib/utils"
import { useState } from "react"

export function ExitCodeBadge({ code }: { code: number }) {
  const ok = code === 0
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 font-mono text-xs",
        ok
          ? "bg-success/15 text-success"
          : "bg-destructive/15 text-destructive"
      )}
    >
      exit {code}
    </span>
  )
}

// Code block with a "Show more" toggle once the content is longer than
// `maxLines`. Scrollable so a fully-expanded huge output doesn't blow up
// the page.
export function CodeOutput({
  code,
  language = "text",
  maxLines = 12,
  className,
}: {
  code: string
  language?: string
  maxLines?: number
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const lines = code.split("\n")
  const isTruncated = lines.length > maxLines
  const display = isTruncated && !expanded ? lines.slice(0, maxLines).join("\n") : code

  return (
    <div className={className}>
      <CodeBlock className="rounded-md">
        <div className="max-h-96 overflow-y-auto">
          <CodeBlockCode code={display || " "} language={language} />
        </div>
      </CodeBlock>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground mt-1 text-xs underline underline-offset-2"
        >
          {expanded ? "Show less" : `Show more (${lines.length - maxLines} more lines)`}
        </button>
      )}
    </div>
  )
}

// Hermes tool results sometimes arrive as plain objects, sometimes wrapped
// as `{ content: [{ type: "text", text: "<json>" }] }`. Normalize both.
export function parseToolResult(result: unknown): unknown {
  if (result === undefined || result === null) return null
  if (Array.isArray(result)) return result
  if (typeof result === "object" && "content" in (result as Record<string, unknown>)) {
    const content = (result as Record<string, unknown>).content
    const textContent = Array.isArray(content)
      ? content.find((item) => item?.type === "text")
      : null
    if (typeof textContent?.text === "string") {
      try {
        return JSON.parse(textContent.text)
      } catch {
        return textContent.text
      }
    }
  }
  return result
}

// Re-exported so per-tool bodies (file-tool.tsx etc.) share one import path;
// the actual collapsible chrome (icon/label/status/expand) is now the
// Elements <Tool>/<ToolHeader>/<ToolContent> trio in tool-invocation.tsx.
export type { ToolPart as ToolUIPart }

export type ToolBodyProps = {
  toolName: string
  toolData: ToolPart
  defaultOpen?: boolean
  className?: string
}
