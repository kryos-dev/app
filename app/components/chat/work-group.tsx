"use client"

import { MessageResponse } from "@/components/ai-elements/message"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { cn } from "@/lib/utils"
import { isToolUIPart, type UIMessage } from "ai"
import { ChevronDownIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ToolInvocation } from "./tool-invocation"
import { getToolLabel } from "./tools/tool-labels"

type Part = UIMessage["parts"][number]

export type Run = { kind: "text"; text: string } | { kind: "work"; parts: Part[] }

const isWork = (p: Part) => p.type === "reasoning" || isToolUIPart(p)

// Split a message into prose and work runs, in order, like claude.ai: all the
// thinking and tool calls between two pieces of visible text are ONE run
// ("text, work, text"). Whitespace-only text never splits a run.
export function segmentParts(parts: Part[]): Run[] {
  const runs: Run[] = []
  for (const p of parts) {
    const last = runs[runs.length - 1]
    if (isWork(p)) {
      if (last?.kind === "work") last.parts.push(p)
      else runs.push({ kind: "work", parts: [p] })
    } else if (p.type === "text" && p.text) {
      if (last?.kind === "text") last.text += p.text
      else if (p.text.trim()) runs.push({ kind: "text", text: p.text })
    }
  }
  return runs
}

function toolNameOf(p: Part): string {
  if ("toolName" in p && typeof p.toolName === "string") return p.toolName
  return p.type.startsWith("tool-") ? p.type.slice(5) : p.type
}

const COMMAND_TOOLS = new Set(["terminal", "execute_code", "process_manage"])

function toolsLabel(tools: Part[], running: boolean): string {
  const n = tools.length
  if (n === 1) return getToolLabel(toolNameOf(tools[0]), running)
  if (tools.every((t) => COMMAND_TOOLS.has(toolNameOf(t))))
    return running ? `Running ${n} commands…` : `Ran ${n} commands`
  return running ? `Using ${n} tools…` : `Used ${n} tools`
}

const isRunningTool = (p: Part) =>
  isToolUIPart(p) && p.state !== "output-available" && p.state !== "output-error"

// The one live label for the step in progress: the streaming thinking block,
// the running tool call(s), or "Thinking" between steps.
function liveLabel(parts: Part[]): string {
  const last = parts[parts.length - 1]
  if (last.type === "reasoning" && last.state === "streaming") return "Thinking"
  const running = parts.filter(isRunningTool)
  if (running.length) return toolsLabel(running, true)
  return "Thinking"
}

function doneLabel(parts: Part[], seconds: number | null): string {
  const tools = parts.filter(isToolUIPart)
  const n = tools.length
  if (n === 0) {
    if (!parts.some((p) => p.type === "reasoning")) return "Approval requested"
    return seconds ? `Thought for ${seconds}s` : "Thought"
  }
  if (!seconds) return toolsLabel(tools, false)
  return `Worked for ${seconds}s · ${n} ${n === 1 ? "tool" : "tools"}`
}

// One collapsed row for a whole run of thinking + tool calls. While it runs,
// the header is the single shimmering live label; when done it summarises
// ("Worked for 42s · 11 tools"). Expanded: a compact timeline, thinking text
// and tool rows in stream order. The duration is measured here, so a reloaded
// chat falls back to "Thought" / "Used N tools".
export function WorkGroup({
  parts,
  live,
  timings,
  showTools,
}: {
  parts: Part[]
  live: boolean
  timings?: Record<string, number>
  showTools: boolean
}) {
  const [open, setOpen] = useState(false)
  const startedAt = useRef<number | null>(null)
  const [seconds, setSeconds] = useState<number | null>(null)
  useEffect(() => {
    if (live) {
      startedAt.current ??= Date.now()
    } else if (startedAt.current !== null) {
      setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)))
    }
  }, [live])

  // The "show tool invocations" preference hides tools only.
  const steps = parts.filter(
    (p) =>
      (p.type === "reasoning" && p.text.trim()) || (showTools && isToolUIPart(p))
  )
  if (steps.length === 0 && !live) return null

  const label = live ? liveLabel(parts) : doneLabel(parts, seconds)

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <Collapsible open={open} onOpenChange={setOpen} className="w-full min-w-0">
        <CollapsibleTrigger
          className={cn(
            "text-muted-foreground hover:text-foreground flex items-center gap-1 py-1 text-left text-sm transition-colors",
            steps.length === 0 && "pointer-events-none"
          )}
        >
          {live ? <Shimmer as="span">{label}</Shimmer> : <span>{label}</span>}
          {steps.length > 0 && (
            <ChevronDownIcon
              className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          )}
        </CollapsibleTrigger>
        {steps.length > 0 && (
          <CollapsibleContent className="border-border mt-1 flex w-full min-w-0 flex-col border-l">
            {steps.map((part, i) =>
              isToolUIPart(part) ? (
                <ToolInvocation
                  key={part.toolCallId ?? i}
                  toolInvocations={[part]}
                  timings={timings}
                />
              ) : part.type === "reasoning" ? (
                <div
                  key={i}
                  className="prose prose-sm dark:prose-invert text-muted-foreground w-full min-w-0 max-w-full px-3 py-1"
                >
                  <MessageResponse>{part.text}</MessageResponse>
                </div>
              ) : null
            )}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  )
}
