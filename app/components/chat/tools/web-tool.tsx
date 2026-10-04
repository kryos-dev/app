"use client"

import type { ReactNode } from "react"
import { CodeOutput, parseToolResult, type ToolBodyProps } from "./tool-shell"

type LinkItem = { title?: string; url?: string; snippet?: string }

const MAX_SOURCES = 5

function hostname(url?: string) {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// web_search / web_extract / browser_navigate
export function WebTool({ toolName, toolData, className }: ToolBodyProps) {
  const { state } = toolData
  const args = toolData.input as Record<string, unknown> | undefined
  const isRunning = state !== "output-available" && state !== "output-error"
  const detail = (args?.query ?? args?.url) as string | undefined
  const result = state === "output-available" ? parseToolResult(toolData.output) : null
  const resultObj = (result && typeof result === "object" ? result : {}) as Record<
    string,
    unknown
  >

  const items: LinkItem[] = Array.isArray(result)
    ? (result as LinkItem[]).filter((i) => i && typeof i === "object" && "url" in i)
    : Array.isArray(resultObj.results)
      ? (resultObj.results as LinkItem[])
      : []

  let body: ReactNode
  if (toolName === "web_extract") {
    const text =
      typeof result === "string"
        ? result
        : ((resultObj.text as string) ?? (resultObj.content as string) ?? "")
    body = text ? (
      <CodeOutput code={text} />
    ) : (
      <div className="text-muted-foreground text-xs">
        {isRunning ? "Extracting…" : "No content"}
      </div>
    )
  } else if (items.length > 0) {
    const shown = items.slice(0, MAX_SOURCES)
    const remaining = items.length - shown.length
    body = (
      <div className="space-y-2">
        {shown.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-accent -mx-1.5 block rounded px-1.5 py-1"
          >
            <div className="truncate text-sm font-medium">{item.title || item.url}</div>
            <div className="bg-secondary text-muted-foreground mt-1 inline-block rounded-full px-1.5 py-0.5 font-mono text-xs">
              {hostname(item.url)}
            </div>
            {item.snippet && (
              <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                {item.snippet}
              </div>
            )}
          </a>
        ))}
        {remaining > 0 && (
          <div className="text-muted-foreground px-1.5 text-xs">
            +{remaining} more
          </div>
        )}
      </div>
    )
  } else {
    body = (
      <div className="text-muted-foreground text-xs">
        {isRunning ? "Working…" : "No results"}
      </div>
    )
  }

  return (
    <div className={className}>
      {detail && (
        <div className="text-muted-foreground mb-2 truncate text-xs">{detail}</div>
      )}
      {body}
    </div>
  )
}
