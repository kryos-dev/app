"use client"

import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/components/ai-elements/context"
import type { LanguageModelUsage } from "ai"

const FALLBACK = 128_000

// AI Elements Context meter fed by the last assistant turn's usage
// (`data-turn` part). Window size is a fixed fallback.
export function ContextMeter({
  usage,
  modelId,
}: {
  usage?: LanguageModelUsage
  modelId: string
}) {
  if (!usage) return null
  const used = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)

  return (
    <Context maxTokens={FALLBACK} modelId={modelId} usage={usage} usedTokens={used}>
      <ContextTrigger size="sm" className="h-8 rounded-full px-2" />
      <ContextContent>
        <ContextContentHeader />
        <ContextContentBody>
          <ContextInputUsage />
          <ContextOutputUsage />
          <ContextReasoningUsage />
          <ContextCacheUsage />
        </ContextContentBody>
        <ContextContentFooter />
      </ContextContent>
    </Context>
  )
}
