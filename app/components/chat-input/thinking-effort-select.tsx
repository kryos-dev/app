"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  normalizeThinkingEffort,
  THINKING_LEVELS,
  type ThinkingEffort,
} from "@/lib/thinking-effort"
import { BrainIcon } from "@phosphor-icons/react"

export type { ThinkingEffort }

export function ThinkingEffortSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  // Normalised, so a preference saved when this slider still offered "auto"
  // or "xhigh" lands on a rung that exists instead of pinning the handle at 0.
  const current = normalizeThinkingEffort(value)
  const index = THINKING_LEVELS.findIndex((l) => l.value === current)
  const level = THINKING_LEVELS[index]
  // The icon lights up whenever the model is thinking, so the one rung that
  // turns thinking off is the one that leaves it dim.
  const active = current !== "none"

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Thinking effort: ${level.label}`}
              className={cn(
                "size-8 rounded-full",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <BrainIcon className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Thinking effort: {level.label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-56 rounded-2xl p-4">
        <div className="mb-1 text-center text-sm font-medium">{level.label}</div>
        <div className="text-muted-foreground mb-3 text-center text-xs">
          {level.hint}
        </div>
        <Slider
          min={0}
          max={THINKING_LEVELS.length - 1}
          step={1}
          value={[index]}
          onValueChange={([i]) => onChange(THINKING_LEVELS[i].value)}
          aria-label="Thinking effort"
        />
        <div className="text-muted-foreground mt-2 flex justify-between text-xs">
          <span>Instant</span>
          <span>Max</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
