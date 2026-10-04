"use client"

import { parseToolResult, type ToolBodyProps } from "./tool-shell"

function findImageUrl(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined
  const obj = result as Record<string, unknown>
  const candidates = [obj.url, obj.image_url, obj.image, obj.data_url]
  return candidates.find((v) => typeof v === "string") as string | undefined
}

function findCaption(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined
  const obj = result as Record<string, unknown>
  const candidates = [obj.caption, obj.description, obj.text]
  return candidates.find((v) => typeof v === "string") as string | undefined
}

// vision_analyze / image_generate
export function MediaTool({ toolName, toolData, className }: ToolBodyProps) {
  const { state } = toolData
  const isRunning = state !== "output-available" && state !== "output-error"
  const result = state === "output-available" ? parseToolResult(toolData.output) : null
  const imageUrl = findImageUrl(result)
  const caption = findCaption(result)

  return (
    <div className={className}>
      {imageUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- tool result URL, not a build-time asset */}
          <img
            src={imageUrl}
            alt={caption || toolName}
            className="max-h-80 max-w-80 rounded border object-contain"
          />
          {caption && <div className="text-muted-foreground text-sm">{caption}</div>}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm">
          {isRunning ? "Processing…" : caption || "No image"}
        </div>
      )}
    </div>
  )
}
