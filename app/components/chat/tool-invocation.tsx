"use client"

import { ToolInput, ToolOutput, type ToolPart } from "@/components/ai-elements/tool"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import { ChevronRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { getToolRenderer } from "./tools"
import { getToolLabel, getToolSummary } from "./tools/tool-labels"

type ToolUIPart = ToolPart

interface ToolInvocationProps {
  toolInvocations: UIMessage["parts"]
  className?: string
  defaultOpen?: boolean
  /** toolCallId -> wall-clock ms, from the turn's `data-turn` part */
  timings?: Record<string, number>
}

function toolNameOf(type: string): string {
  return type.startsWith("tool-") ? type.slice("tool-".length) : type
}

export function formatMs(ms?: number): string | null {
  if (ms === undefined || !Number.isFinite(ms)) return null
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
  return `${Math.round(ms / 60_000)}m`
}

// One flat transcript row per step (icon · label · summary · duration ·
// chevron); the body expands underneath. No per-row card chrome, so a run
// with many steps reads as a list, like Claude's activity view.
export function StepRow({
  icon,
  label,
  summary,
  running,
  error,
  durationMs,
  defaultOpen = false,
  children,
}: {
  icon?: ReactNode
  label: string
  summary?: string
  running?: boolean
  error?: boolean
  durationMs?: number
  defaultOpen?: boolean
  children?: ReactNode
}) {
  const ms = formatMs(durationMs)
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/row w-full min-w-0">
      <CollapsibleTrigger
        className={cn(
          "hover:bg-accent/40 flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
          !children && "pointer-events-none"
        )}
      >
        {icon && (
          <span className="text-muted-foreground flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
            {icon}
          </span>
        )}
        <span className="text-muted-foreground shrink-0">
          {/* No shimmer here: the run's header is the one live label; the
              pulsing dot marks a running step. */}
          {label}
        </span>
        {summary && (
          <>
            <span className="text-muted-foreground shrink-0">-</span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{summary}</span>
          </>
        )}
        {!summary && <span className="flex-1" />}
        {(ms || running || error) && (
          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
            <span
              className={cn(
                "size-1.5 rounded-full",
                error ? "bg-destructive" : running ? "bg-warning animate-pulse" : "bg-success"
              )}
            />
            {ms}
          </span>
        )}
        {children && (
          <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]/row:rotate-90" />
        )}
      </CollapsibleTrigger>
      {children && (
        <CollapsibleContent className="min-w-0 px-2 pb-2">
          {/* Every step body is the same box: full width, capped height,
              scrolls inside. Long output never stretches the transcript. */}
          <div className="max-h-80 w-full min-w-0 overflow-y-auto rounded-lg">{children}</div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

export function ToolInvocation({
  toolInvocations,
  className,
  defaultOpen = false,
  timings,
}: ToolInvocationProps) {
  const toolParts = toolInvocations.filter(
    (part) => part.type.startsWith("tool-") || part.type === "dynamic-tool"
  ) as unknown as ToolUIPart[]
  if (toolParts.length === 0) return null

  return (
    <div className={cn("flex w-full min-w-0 max-w-full flex-col", className)}>
      {toolParts.map((tool, i) => (
        <ToolCard
          key={tool.toolCallId ?? `${tool.type}-${i}`}
          toolData={tool}
          defaultOpen={defaultOpen}
          durationMs={tool.toolCallId ? timings?.[tool.toolCallId] : undefined}
        />
      ))}
    </div>
  )
}

function ToolCard({
  toolData,
  defaultOpen,
  durationMs,
}: {
  toolData: ToolUIPart
  defaultOpen?: boolean
  durationMs?: number
}) {
  const toolName =
    "toolName" in toolData
      ? String((toolData as { toolName?: string }).toolName)
      : toolNameOf(toolData.type)
  const isRunning = toolData.state !== "output-available" && toolData.state !== "output-error"
  const Renderer = getToolRenderer(toolName)

  return (
    <StepRow
      label={getToolLabel(toolName, isRunning)}
      summary={getToolSummary(toolData.input)}
      running={isRunning}
      error={toolData.state === "output-error"}
      durationMs={durationMs}
      defaultOpen={defaultOpen}
    >
      {Renderer ? (
        <Renderer toolName={toolName} toolData={toolData} />
      ) : (
        <>
          <ToolInput input={toolData.input} />
          <ToolOutput output={toolData.output} errorText={toolData.errorText} />
        </>
      )}
    </StepRow>
  )
}
