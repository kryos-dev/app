"use client"

import { parseToolResult, type ToolBodyProps } from "./tool-shell"

function firstMeaningfulArg(args: Record<string, unknown> | undefined) {
  if (!args) return undefined
  for (const v of Object.values(args)) {
    if (typeof v === "string" && v.trim()) return v
  }
  return undefined
}

const PENDING_KEYS = ["query", "prompt", "task", "topic", "text"] as const

function pendingInput(args: Record<string, unknown> | undefined) {
  if (!args || Object.keys(args).length === 0) return undefined
  for (const k of PENDING_KEYS) {
    const v = args[k]
    if (typeof v === "string" && v.trim()) return v
  }
  return JSON.stringify(args, null, 2).slice(0, 800)
}

// delegate_task, memory, todo_list, skill_*, cronjob_manage, session_search,
// manage_connections: one-line summary row, expands to the generic JSON view.
export function SummaryTool({ toolData, className }: ToolBodyProps) {
  const { state } = toolData
  const args = toolData.input as Record<string, unknown> | undefined
  const isRunning = state !== "output-available" && state !== "output-error"
  const result = state === "output-available" ? parseToolResult(toolData.output) : null
  const summaryArg = firstMeaningfulArg(args)
  const pending = isRunning ? pendingInput(args) : undefined

  return (
    <div className={className}>
      <div className="space-y-2 font-mono text-sm">
        {/* Hermes emits a tool's output atomically (response.output_item.done),
            so nothing streams while a report/skill tool runs. The request is
            the only thing we have before it returns, so show that. */}
        {isRunning && (
          <div className="text-muted-foreground text-13 space-y-1">
            <div>Working…</div>
            {pending && (
              <pre className="whitespace-pre-wrap break-words">{pending}</pre>
            )}
          </div>
        )}
        {!isRunning && summaryArg && (
          <div className="text-muted-foreground not-italic">{summaryArg}</div>
        )}
        {!isRunning && args && Object.keys(args).length > 0 && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(args, null, 2)}</pre>
        )}
        {result != null && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}
