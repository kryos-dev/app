import type { LanguageModelUsage } from "ai"

// One `data-turn` part per assistant message, written by both runtime
// mappers right before `finish`. It rides in `parts`, so it persists with
// the message and survives reloads; the UI reads it for the step-group
// header (duration) and the context meter (usage).
export type TurnData = {
  durationMs: number
  usage?: LanguageModelUsage
  /** toolCallId -> wall-clock ms between the call and its result */
  tools?: Record<string, number>
}

// Tracks tool call start times inside a mapper; `end` returns the elapsed ms
// and records it for the data-turn part.
export function toolTimer() {
  const started = new Map<string, number>()
  const tools: Record<string, number> = {}
  return {
    start(id: string) {
      started.set(id, Date.now())
    },
    end(id: string) {
      const t0 = started.get(id)
      if (t0 !== undefined) tools[id] = Date.now() - t0
      started.delete(id)
    },
    tools,
  }
}

type RawUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export function turnData(
  startedAt: number,
  raw: RawUsage,
  tools?: Record<string, number>
): TurnData {
  const input = raw.inputTokens
  const output = raw.outputTokens
  const hasUsage = [input, output, raw.totalTokens].some(
    (n) => typeof n === "number"
  )
  const usage: LanguageModelUsage | undefined = hasUsage
    ? {
        inputTokens: input,
        inputTokenDetails: {
          noCacheTokens:
            typeof input === "number" && typeof raw.cacheReadTokens === "number"
              ? input - raw.cacheReadTokens
              : input,
          cacheReadTokens: raw.cacheReadTokens,
          cacheWriteTokens: raw.cacheWriteTokens,
        },
        outputTokens: output,
        outputTokenDetails: {
          textTokens:
            typeof output === "number" && typeof raw.reasoningTokens === "number"
              ? output - raw.reasoningTokens
              : output,
          reasoningTokens: raw.reasoningTokens,
        },
        totalTokens: raw.totalTokens ?? (input ?? 0) + (output ?? 0),
      }
    : undefined
  return { durationMs: Date.now() - startedAt, usage, tools }
}

export function turnFromParts(
  parts: Array<{ type: string; data?: unknown }> | undefined
): TurnData | undefined {
  const part = parts?.find((p) => p.type === "data-turn")
  return part?.data as TurnData | undefined
}
