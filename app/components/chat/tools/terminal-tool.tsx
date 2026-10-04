"use client"

import { Terminal } from "@/components/tool-ui/terminal"
import { parseToolResult, type ToolBodyProps } from "./tool-shell"

type TerminalResult = {
  output?: string
  error?: string | null
  exit_code?: number
}

// terminal / execute_code / process_manage, rendered with Tool UI's Terminal.
export function TerminalTool({ toolData, className }: ToolBodyProps) {
  const { state } = toolData
  const args = toolData.input as Record<string, unknown> | undefined
  const result =
    state === "output-available"
      ? (parseToolResult(toolData.output) as TerminalResult | string | null)
      : null
  const command = String(args?.command ?? args?.code ?? "")
  // Always render the card: while running it shows the command alone, so
  // the box never flips size when output lands.
  const obj =
    result == null ? {} : typeof result === "string" ? { output: result } : result
  const stderr = obj.error
    ? String(obj.error)
    : state === "output-error"
      ? String(toolData.errorText ?? "Command failed")
      : undefined
  const exitCode =
    typeof obj.exit_code === "number" ? obj.exit_code : stderr ? 1 : 0

  return (
    <div className={className}>
      <Terminal
        id={toolData.toolCallId}
        command={command}
        stdout={obj.output ?? ""}
        stderr={stderr}
        exitCode={exitCode}
      />
    </div>
  )
}
